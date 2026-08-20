import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShoppingCart, Plus, Search, Eye, AlertCircle, Trash2, Import, Printer, DollarSign, Clock, Store, FileText, CheckCircle, XCircle, TrendingUp, CreditCard, CalendarClock, Wallet, BanknoteIcon } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { usePurchaseOrders, useSuppliers, useInventoryItems, useUnits, useTenantBranch } from '@/hooks/useDatabase';
import { db } from '@/lib/firebase';
import { collection, doc, query, where, getDocs, addDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { addExpense } from '@/services/expenses';

export default function Purchasing() {
  const { tenantId, branchId } = useTenantBranch();
  const { orders, loading: ordersLoading, add: addOrder, update: updateOrder, remove: removeOrder } = usePurchaseOrders(tenantId);
  const { suppliers } = useSuppliers(tenantId);
  const { items: inventoryItems } = useInventoryItems(tenantId);
  const { units } = useUnits(tenantId);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Add Order Form State
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState<{ itemId: string; quantity: number; unitId: string; unitPrice: number; name?: string }[]>([]);

  // Installment / Deferred Payment State
  const [isDeferred, setIsDeferred] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = (o.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (suppliers.find(s => s.id === o.supplier_id)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'all' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, filterStatus, suppliers]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const receivedOrders = orders.filter(o => o.status === 'received');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const deferredOrders = orders.filter(o => o.payment_type === 'deferred' && o.status === 'received' && o.payment_status !== 'paid');

    return {
      totalPurchasesValue: receivedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      receivedCount: receivedOrders.length,
      pendingOrdersValue: pendingOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      pendingCount: pendingOrders.length,
      suppliersCount: suppliers.length,
      totalDeferred: deferredOrders.reduce((sum, o) => sum + (Number(o.total_amount || 0) - Number(o.paid_amount || 0)), 0),
      deferredCount: deferredOrders.length,
    };
  }, [orders, suppliers]);

  const totalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
  }, [orderItems]);

  const remainingAmount = useMemo(() => {
    if (!isDeferred) return 0;
    return Math.max(0, totalAmount - Number(paidAmount));
  }, [totalAmount, paidAmount, isDeferred]);

  const handleAddItem = () => {
    setOrderItems([...orderItems, { itemId: '', quantity: 1, unitId: '', unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'itemId') {
       const invItem = inventoryItems.find((i: any) => i.id === value);
       if (invItem) {
          newItems[index].unitPrice = invItem.cost || 0;
          newItems[index].name = invItem.name || '';
          newItems[index].unitId = invItem.unit_id || '';
       }
    }

    setOrderItems(newItems);
  };

  const resetForm = () => {
    setSupplierId('');
    setNotes('');
    setOrderItems([]);
    setIsDeferred(false);
    setPaidAmount(0);
    setDueDate('');
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || orderItems.length === 0) return;

    if (orderItems.some(i => !i.itemId || !i.unitId || Number(i.quantity) <= 0)) {
        alert("يرجى التأكد من اختيار جميع الأصناف، وحدات القياس والكميات بشكل صحيح.");
        return;
    }

    if (isDeferred && !dueDate) {
      alert("يرجى تحديد تاريخ سداد المبلغ المتبقي للمورد.");
      return;
    }

    if (isDeferred && Number(paidAmount) > totalAmount) {
      alert("المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي الفاتورة.");
      return;
    }

    setIsSubmitting(true);

    const orderNumber = `PO-${Date.now().toString().slice(-6)}`;

    const newOrder: any = {
      order_number: orderNumber,
      supplier_id: supplierId,
      status: 'pending',
      items: orderItems,
      total_amount: totalAmount,
      notes: notes,
      created_at: new Date().toISOString(),
      payment_type: isDeferred ? 'deferred' : 'cash',
      payment_status: isDeferred ? (Number(paidAmount) >= totalAmount ? 'paid' : (Number(paidAmount) > 0 ? 'partial' : 'unpaid')) : 'paid',
      paid_amount: isDeferred ? Number(paidAmount) : totalAmount,
      due_date: isDeferred ? dueDate : null,
    };

    const success = await addOrder(newOrder);
    if (success) {
      setIsAddDialogOpen(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'غير معروف';
  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || 'غير معروف';

  const handleUpdateStatus = async (status: string) => {
    if (!viewingOrder) return;
    setIsSubmitting(true);

    if (status === 'received' && viewingOrder.status !== 'received') {
      try {
        // 1. Update Inventory for each item
        for (const item of viewingOrder.items) {
           const qty = Number(item.quantity) || 0;
           const newCost = Number(item.unitPrice) || 0;

           if (qty > 0 && branchId) {
              const stockQ = query(collection(db, 'branch_stock'), where('branch_id', '==', branchId), where('item_id', '==', item.itemId));
              const exist = await getDocs(stockQ);

              let currentQty = 0;
              if (!exist.empty) {
                currentQty = Number(exist.docs[0].data().quantity) || 0;
                await updateDoc(doc(db, 'branch_stock', exist.docs[0].id), {
                  quantity: increment(qty)
                });
              } else {
                await addDoc(collection(db, 'branch_stock'), {
                  branch_id: branchId,
                  item_id: item.itemId,
                  quantity: qty
                });
              }

              // Update item overall cost using Weighted Average Cost
              const invItemRef = doc(db, 'inventory_items', item.itemId);
              const invItemSnap = await getDoc(invItemRef);
              if (invItemSnap.exists()) {
                 const oldCost = Number(invItemSnap.data().cost_per_unit) || 0;
                 const newTotalQty = currentQty + qty;
                 if (newTotalQty > 0) {
                     const totalOldValue = currentQty * oldCost;
                     const totalNewValue = qty * newCost;
                     const avgCost = (totalOldValue + totalNewValue) / newTotalQty;
                     await updateDoc(invItemRef, {
                         cost_per_unit: avgCost
                     });
                 }
              }

              await addDoc(collection(db, 'stock_movements'), {
                tenant_id: tenantId,
                branch_id: branchId,
                item_id: item.itemId,
                movement_type: 'purchase',
                quantity: qty,
                notes: `استلام طلب شراء رقم ${viewingOrder.order_number} بتكلفة وحدة ${newCost} ج.م`,
                created_at: new Date().toISOString()
              });
           }
        }

        // 2. Add Expense - only for the paid amount
        const paidAmt = viewingOrder.payment_type === 'deferred'
          ? Number(viewingOrder.paid_amount || 0)
          : Number(viewingOrder.total_amount);

        if (paidAmt > 0) {
          await addExpense({
            amount: paidAmt,
            category: 'مشتريات',
            description: `${viewingOrder.payment_type === 'deferred' ? 'دفعة مقدمة - ' : ''}فاتورة مشتريات لأمر الشراء رقم ${viewingOrder.order_number} من المورد ${getSupplierName(viewingOrder.supplier_id)}`,
            date: new Date().toISOString().split('T')[0],
            branchId: branchId || undefined,
            tenantId: tenantId
          } as any);
        }

      } catch (err: any) {
        console.error("Error updating stock/expenses:", err);
        alert("حدث خطأ أثناء تحديث المخزون أو المصروفات: " + err.message);
        setIsSubmitting(false);
        return;
      }
    }

    const success = await updateOrder(viewingOrder.id, {
      status,
      updated_at: new Date().toISOString()
    });

    if (success) {
      setViewingOrder({ ...viewingOrder, status });
    }
    setIsSubmitting(false);
  };

  // Mark remaining deferred amount as paid
  const handleMarkRemainingPaid = async () => {
    if (!viewingOrder) return;
    setIsMarkingPaid(true);

    const remaining = Number(viewingOrder.total_amount) - Number(viewingOrder.paid_amount || 0);

    try {
      // Register remaining as expense
      if (remaining > 0) {
        await addExpense({
          amount: remaining,
          category: 'مشتريات',
          description: `سداد المبلغ المتبقي - أمر شراء رقم ${viewingOrder.order_number} من المورد ${getSupplierName(viewingOrder.supplier_id)}`,
          date: new Date().toISOString().split('T')[0],
          branchId: branchId || undefined,
          tenantId: tenantId
        } as any);
      }

      await updateOrder(viewingOrder.id, {
        payment_status: 'paid',
        paid_amount: Number(viewingOrder.total_amount),
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      setViewingOrder({
        ...viewingOrder,
        payment_status: 'paid',
        paid_amount: Number(viewingOrder.total_amount),
      });
    } catch (err: any) {
      alert("حدث خطأ أثناء تسجيل السداد: " + err.message);
    }
    setIsMarkingPaid(false);
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm("هل أنت متأكد من حذف أمر الشراء هذا نهائياً؟")) {
       await removeOrder(id);
       if (viewingOrder?.id === id) setViewingOrder(null);
    }
  };

  const handlePrintOrder = (order: any) => {
    const supplierName = getSupplierName(order.supplier_id);
    const dateStr = new Date(order.created_at).toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const paidAmt = Number(order.paid_amount || (order.payment_type === 'deferred' ? 0 : order.total_amount));
    const remainAmt = Number(order.total_amount) - paidAmt;
    const dueDateStr = order.due_date ? new Date(order.due_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>أمر شراء - ${order.order_number}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 5px 0; }
            .details { margin-bottom: 20px; border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #f9f9f9; }
            .details p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: right; }
            th { background-color: #f2f2f2; }
            .total { font-size: 1.1rem; font-weight: bold; text-align: left; padding: 10px; border-top: 2px solid #333; }
            .payment-box { border: 2px solid #e8b800; background: #fffbeb; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
            .payment-box h3 { margin: 0 0 10px; color: #92400e; }
            .unpaid-label { color: #dc2626; font-weight: bold; }
            .footer { text-align: center; margin-top: 40px; font-size: 0.9rem; color: #666; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>أمر شراء / فاتورة مشتريات</h1>
            <p><strong>رقم الأمر:</strong> ${order.order_number}</p>
          </div>
          <div class="details">
            <p><strong>تاريخ الإصدار:</strong> ${dateStr}</p>
            <p><strong>المورد:</strong> ${supplierName}</p>
            <p><strong>الحالة:</strong> ${order.status === 'received' ? 'مستلم' : order.status === 'cancelled' ? 'ملغي' : 'قيد الانتظار'}</p>
            <p><strong>طريقة الدفع:</strong> ${order.payment_type === 'deferred' ? 'آجل (تقسيط)' : 'نقدي'}</p>
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الوحدة</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map((item: any) => `
                <tr>
                  <td>${item.name || 'مجهول'}</td>
                  <td>${getUnitName(item.unitId) || '-'}</td>
                  <td>${item.quantity}</td>
                  <td>${Number(item.unitPrice).toLocaleString('ar-EG')} ج.م</td>
                  <td>${(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">الإجمالي الكلي: ${Number(order.total_amount).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م</div>
          ${order.payment_type === 'deferred' ? `
          <div class="payment-box">
            <h3>بيان الدفع الآجل</h3>
            <p><strong>المبلغ المدفوع مقدماً:</strong> ${paidAmt.toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
            <p class="unpaid-label">المبلغ المتبقي (الآجل): ${remainAmt.toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
            ${dueDateStr ? `<p><strong>تاريخ استحقاق السداد:</strong> ${dueDateStr}</p>` : ''}
            <p><strong>حالة السداد:</strong> ${order.payment_status === 'paid' ? 'مسدد بالكامل ✓' : order.payment_status === 'partial' ? 'مسدد جزئياً' : 'غير مسدد'}</p>
          </div>
          ` : ''}
          <div class="footer">تم إنشاء هذه الفاتورة بواسطة نظام إدارة المطاعم</div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200">قيد الانتظار</Badge>;
      case 'received': return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">مستلم (تم التسجيل)</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">ملغي</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (order: any) => {
    if (order.payment_type !== 'deferred') {
      return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 gap-1"><Wallet className="w-3 h-3" />نقدي</Badge>;
    }
    const ps = order.payment_status;
    if (ps === 'paid') return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1"><CheckCircle className="w-3 h-3" />آجل - مسدد</Badge>;
    if (ps === 'partial') return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200 gap-1"><CreditCard className="w-3 h-3" />آجل - جزئي</Badge>;
    return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 gap-1"><CalendarClock className="w-3 h-3" />آجل - غير مسدد</Badge>;
  };

  // Check if due date is overdue
  const isOverdue = (order: any) => {
    if (order.payment_type !== 'deferred' || order.payment_status === 'paid') return false;
    if (!order.due_date) return false;
    return new Date(order.due_date) < new Date();
  };

  return (
    <MainLayout
      title="المشتريات"
      subtitle="إدارة المشتريات وأوامر الشراء للمخزون بكل احترافية"
      actions={
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          إنشاء أمر شراء
        </Button>
      }
    >
      <div className="grid gap-6">
        {/* KPIs Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-t-4 border-t-green-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المشتريات (مستلم)</CardTitle>
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {kpis.totalPurchasesValue.toLocaleString('ar-EG', {minimumFractionDigits: 0, maximumFractionDigits: 0})} ج.م
              </div>
              <p className="text-xs text-muted-foreground mt-1">من {kpis.receivedCount} طلب شراء</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-yellow-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الأوامر المعلقة</CardTitle>
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {kpis.pendingOrdersValue.toLocaleString('ar-EG', {minimumFractionDigits: 0, maximumFractionDigits: 0})} ج.م
              </div>
              <p className="text-xs text-muted-foreground mt-1">{kpis.pendingCount} طلب قيد الانتظار</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-red-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ديون الموردين (آجل)</CardTitle>
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                <CalendarClock className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {kpis.totalDeferred.toLocaleString('ar-EG', {minimumFractionDigits: 0, maximumFractionDigits: 0})} ج.م
              </div>
              <p className="text-xs text-muted-foreground mt-1">{kpis.deferredCount} فاتورة غير مسددة</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الموردين</CardTitle>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                <Store className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {kpis.suppliersCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">مورد مسجل بالنظام</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-0 border-t-4 border-t-primary">
          <CardHeader className="bg-card pb-4 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <ShoppingCart className="w-6 h-6 text-primary" />
                  أوامر الشراء
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  عرض وتعديل أوامر الشراء، تحديث المخزون إلكترونياً، وتسجيل المصروفات تلقائياً.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث برقم الأمر أو المورد..."
                  className="pr-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <Tabs defaultValue="all" className="w-full" onValueChange={setFilterStatus}>
              <TabsList className="mb-6 h-10">
                <TabsTrigger value="all" className="px-6 text-sm">الكل</TabsTrigger>
                <TabsTrigger value="pending" className="px-6 text-sm text-yellow-600 data-[state=active]:bg-yellow-50">قيد الانتظار</TabsTrigger>
                <TabsTrigger value="received" className="px-6 text-sm text-green-600 data-[state=active]:bg-green-50">مستلم</TabsTrigger>
                <TabsTrigger value="cancelled" className="px-6 text-sm text-red-600 data-[state=active]:bg-red-50">ملغي</TabsTrigger>
              </TabsList>

              <div className="rounded-lg border border-border/50 overflow-x-auto bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold px-4">رقم الأمر</TableHead>
                      <TableHead className="font-semibold">المورد</TableHead>
                      <TableHead className="font-semibold">التاريخ</TableHead>
                      <TableHead className="font-semibold">الإجمالي</TableHead>
                      <TableHead className="font-semibold">الحالة</TableHead>
                      <TableHead className="font-semibold">الدفع</TableHead>
                      <TableHead className="text-center font-semibold">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <div className="flex justify-center items-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="w-8 h-8 opacity-20" />
                            <p>لا توجد أوامر شراء مطابقة</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id} className={`hover:bg-muted/10 ${isOverdue(order) ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                          <TableCell className="font-bold text-primary px-4">
                            <div className="flex items-center gap-2">
                              {order.order_number}
                              {isOverdue(order) && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0">متأخر</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getSupplierName(order.supplier_id)}</TableCell>
                          <TableCell suppressHydrationWarning className="text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </TableCell>
                          <TableCell className="font-medium text-lg">{Number(order.total_amount).toLocaleString('ar-EG')} ج.م</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>{getPaymentBadge(order)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors" title="عرض التفاصيل" onClick={() => setViewingOrder(order)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-colors" title="حذف أمر الشراء" onClick={() => handleDeleteOrder(order.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Add Purchase Order Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAddDialogOpen(open); }}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto w-11/12 rounded-xl">
          <form onSubmit={handleSubmitOrder}>
            <DialogHeader className="border-b pb-4 mb-4">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Import className="w-6 h-6 text-primary" />
                إنشاء أمر شراء لطلب مخزون
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-8 py-2">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-muted/20 rounded-lg border">
                <div className="space-y-3">
                  <Label className="text-base">المورد <span className="text-red-500">*</span></Label>
                  <Select value={supplierId} onValueChange={setSupplierId} required disabled={isSubmitting}>
                    <SelectTrigger className="h-12 bg-background text-base">
                      <SelectValue placeholder="اختر المورد..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-base">ملاحظات إضافية (اختياري)</Label>
                  <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="أضف أي تفاصيل للفاتورة..."
                    className="h-12 bg-background"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <Label className="text-xl font-bold">الأصناف المطلوبة</Label>
                  <Button type="button" variant="outline" onClick={handleAddItem} className="gap-2 border-primary text-primary hover:bg-primary/10">
                    <Plus className="w-4 h-4" />
                    إضافة صنف
                  </Button>
                </div>

                {orderItems.length === 0 ? (
                  <div className="text-center p-10 border-2 border-dashed border-primary/20 rounded-xl text-muted-foreground flex flex-col items-center gap-3 bg-muted/10">
                    <ShoppingCart className="w-12 h-12 text-primary/30" />
                    <span className="text-lg">لم يتم إضافة أي أصناف حتى الآن</span>
                    <Button type="button" variant="link" onClick={handleAddItem}>انقر هنا للبدء بإضافة الأصناف</Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border shadow-sm overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="w-1/3">الصنف</TableHead>
                          <TableHead className="w-1/6">وحدة القياس</TableHead>
                          <TableHead className="w-1/6 text-center">الكمية</TableHead>
                          <TableHead className="w-1/6 text-center">سعر الوحدة</TableHead>
                          <TableHead className="w-1/6 text-center">الإجمالي</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => (
                          <TableRow key={index} className="hover:bg-transparent">
                            <TableCell className="p-3">
                              <Select value={item.itemId} onValueChange={(val) => handleItemChange(index, 'itemId', val)} disabled={isSubmitting}>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="اختر الصنف..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {inventoryItems.map((inv: any) => (
                                    <SelectItem key={inv.id} value={inv.id}>{inv.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-3">
                              <Select value={item.unitId} onValueChange={(val) => handleItemChange(index, 'unitId', val)} disabled={isSubmitting}>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="الوحدة" />
                                </SelectTrigger>
                                <SelectContent>
                                  {units.map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-3">
                              <Input
                                type="number"
                                min="0.001"
                                step="any"
                                className="w-full text-center bg-background"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                disabled={isSubmitting}
                              />
                            </TableCell>
                            <TableCell className="p-3">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                className="w-full text-center bg-background"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                                disabled={isSubmitting}
                              />
                            </TableCell>
                            <TableCell className="p-3 text-center font-bold text-lg text-primary">
                              {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م
                            </TableCell>
                            <TableCell className="p-3 text-center">
                              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRemoveItem(index)} disabled={isSubmitting}>
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="bg-primary/5 border-t p-5 flex justify-between items-center rounded-b-xl">
                      <span className="text-xl font-bold">إجمالي فاتورة الشراء:</span>
                      <span className="text-3xl font-black text-primary">
                        {totalAmount.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Deferred Payment Section ── */}
              {orderItems.length > 0 && (
                <div className={`rounded-xl border-2 p-5 space-y-5 transition-colors ${isDeferred ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20' : 'border-border bg-muted/10'}`}>
                  {/* Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isDeferred ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-muted'}`}>
                        <CalendarClock className={`w-5 h-5 ${isDeferred ? 'text-orange-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-base">دفع آجل (تقسيط)</p>
                        <p className="text-sm text-muted-foreground">ادفع جزءاً الآن وحدد موعد سداد الباقي للمورد</p>
                      </div>
                    </div>
                    <Switch
                      checked={isDeferred}
                      onCheckedChange={(v) => { setIsDeferred(v); if (!v) { setPaidAmount(0); setDueDate(''); } }}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Deferred Fields */}
                  {isDeferred && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Paid now */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <BanknoteIcon className="w-4 h-4 text-green-600" />
                            المبلغ المدفوع الآن (مقدم)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max={totalAmount}
                            step="any"
                            placeholder="0.00"
                            value={paidAmount || ''}
                            onChange={e => setPaidAmount(Number(e.target.value))}
                            disabled={isSubmitting}
                            className="h-12 bg-background text-lg font-semibold"
                          />
                          <p className="text-xs text-muted-foreground">أدخل 0 إذا كان الدفع بالكامل آجلاً</p>
                        </div>

                        {/* Due date */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-orange-600" />
                            تاريخ سداد المبلغ المتبقي <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            disabled={isSubmitting}
                            className="h-12 bg-background text-base"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>

                      {/* Summary Box */}
                      <div className="bg-background rounded-lg border p-4 grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">إجمالي الفاتورة</p>
                          <p className="text-lg font-bold text-primary">{totalAmount.toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">المدفوع مقدماً</p>
                          <p className="text-lg font-bold text-green-600">{Number(paidAmount).toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">الآجل (المتبقي)</p>
                          <p className="text-lg font-bold text-red-600">{remainingAmount.toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
                        </div>
                      </div>

                      {/* Progress */}
                      {totalAmount > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>نسبة السداد</span>
                            <span>{Math.round((Number(paidAmount) / totalAmount) * 100)}%</span>
                          </div>
                          <Progress value={(Number(paidAmount) / totalAmount) * 100} className="h-2" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-5 mt-4">
              <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }} disabled={isSubmitting} className="px-8">إلغاء</Button>
              <Button type="submit" disabled={isSubmitting || orderItems.length === 0} className="px-8 shadow-sm">
                {isSubmitting ? 'جاري الحفظ للتسجيل...' : 'حفظ وإنشاء الأمر'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View/Edit Order Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="max-w-4xl rounded-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary" />
              تفاصيل أمر الشراء وإدارته
            </DialogTitle>
          </DialogHeader>

          {viewingOrder && (
            <div className="space-y-6 py-2">
              {/* Order Header Info */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-muted/30 p-5 rounded-xl border">
                <div className="space-y-1">
                  <h3 className="font-bold text-2xl text-primary">{viewingOrder.order_number}</h3>
                  <p className="text-muted-foreground text-base">المورد: <span className="font-semibold text-foreground">{getSupplierName(viewingOrder.supplier_id)}</span></p>
                  <p className="text-sm">بتاريخ: {new Date(viewingOrder.created_at).toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end gap-2">
                  <div>{getStatusBadge(viewingOrder.status)}</div>
                  <div>{getPaymentBadge(viewingOrder)}</div>
                </div>
              </div>

              {/* Deferred Payment Info Panel */}
              {viewingOrder.payment_type === 'deferred' && (
                <div className={`rounded-xl border-2 p-5 space-y-4 ${viewingOrder.payment_status === 'paid' ? 'border-green-400 bg-green-50/50 dark:bg-green-950/20' : isOverdue(viewingOrder) ? 'border-red-400 bg-red-50/50 dark:bg-red-950/20' : 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock className={`w-5 h-5 ${viewingOrder.payment_status === 'paid' ? 'text-green-600' : isOverdue(viewingOrder) ? 'text-red-600' : 'text-orange-600'}`} />
                    <h4 className="font-bold text-base">بيان الدفع الآجل</h4>
                    {isOverdue(viewingOrder) && (
                      <Badge variant="destructive" className="mr-auto">مستحق ومتأخر</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-background rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">إجمالي الفاتورة</p>
                      <p className="text-xl font-black text-primary">{Number(viewingOrder.total_amount).toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                      <p className="text-xl font-black text-green-600">{Number(viewingOrder.paid_amount || 0).toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">المتبقي (الآجل)</p>
                      <p className="text-xl font-black text-red-600">
                        {(Number(viewingOrder.total_amount) - Number(viewingOrder.paid_amount || 0)).toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  {Number(viewingOrder.total_amount) > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>نسبة السداد</span>
                        <span>{Math.round((Number(viewingOrder.paid_amount || 0) / Number(viewingOrder.total_amount)) * 100)}%</span>
                      </div>
                      <Progress value={(Number(viewingOrder.paid_amount || 0) / Number(viewingOrder.total_amount)) * 100} className="h-3" />
                    </div>
                  )}

                  {viewingOrder.due_date && (
                    <div className={`flex items-center gap-2 text-sm font-medium p-3 rounded-lg ${isOverdue(viewingOrder) ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'}`}>
                      <CalendarClock className="w-4 h-4 shrink-0" />
                      {isOverdue(viewingOrder) ? 'تجاوز تاريخ الاستحقاق: ' : 'تاريخ سداد المبلغ المتبقي: '}
                      <span className="font-bold">
                        {new Date(viewingOrder.due_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  )}

                  {/* Mark as Paid Button */}
                  {viewingOrder.payment_status !== 'paid' && viewingOrder.status === 'received' && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 font-bold h-12"
                      onClick={handleMarkRemainingPaid}
                      disabled={isMarkingPaid}
                    >
                      <CheckCircle className="w-5 h-5" />
                      {isMarkingPaid ? 'جاري التسجيل...' : `تسجيل سداد المبلغ المتبقي (${(Number(viewingOrder.total_amount) - Number(viewingOrder.paid_amount || 0)).toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م)`}
                    </Button>
                  )}

                  {viewingOrder.payment_status === 'paid' && (
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm bg-green-100 dark:bg-green-900/30 p-3 rounded-lg justify-center">
                      <CheckCircle className="w-5 h-5" />
                      تم سداد كامل المبلغ للمورد
                    </div>
                  )}
                </div>
              )}

              {viewingOrder.notes && (
                <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-200 p-4 rounded-lg text-sm border border-orange-200 dark:border-orange-900 shadow-sm flex gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <strong className="block mb-1">ملاحظات الفاتورة:</strong>
                    {viewingOrder.notes}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  تفاصيل الأصناف المشتراة
                </h4>
                <div className="rounded-xl border border-border shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="font-semibold">الصنف</TableHead>
                        <TableHead className="text-center font-semibold">وحدة القياس</TableHead>
                        <TableHead className="text-center font-semibold">الكمية</TableHead>
                        <TableHead className="text-center font-semibold">سعر الوحدة</TableHead>
                        <TableHead className="text-left font-semibold px-4">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingOrder.items && viewingOrder.items.map((item: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{item.name || inventoryItems.find((i: any) => i.id === item.itemId)?.name || 'مجهول'}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{getUnitName(item.unitId) || '-'}</TableCell>
                          <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                          <TableCell className="text-center">{Number(item.unitPrice).toLocaleString('ar-EG')} ج.م</TableCell>
                          <TableCell className="text-left font-bold text-base px-4">{(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="bg-primary/5 border-t p-4 flex justify-between items-center rounded-b-xl">
                    <span className="text-lg font-bold">الإجمالي الكلي للفاتورة:</span>
                    <span className="text-2xl font-black text-primary px-4">
                      {Number(viewingOrder.total_amount).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Receive / Cancel Actions */}
              {viewingOrder.status === 'pending' && (
                <div className="flex flex-col md:flex-row justify-between items-center bg-card border shadow-sm rounded-xl p-6 mt-6 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-bold text-lg flex items-center gap-2">تأكيد الاستلام أو الإلغاء</h4>
                    <p className="text-sm text-muted-foreground max-w-lg">
                      تأكيد استلامك لهذا الطلب سيقوم تلقائياً <strong>برفع كمية المخزون</strong> وإضافة المبالغ المذكورة إلى <strong>جدول المصروفات</strong>. هذه العملية غير قابلة للتراجع بسهولة.
                    </p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <Button variant="outline" className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50 hover:border-red-300 flex-1 md:flex-none"
                      onClick={() => handleUpdateStatus('cancelled')}
                      disabled={isSubmitting}>
                      إلغاء الأمر
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm flex-1 md:flex-none gap-2 font-bold"
                      onClick={() => handleUpdateStatus('received')}
                      disabled={isSubmitting}>
                      <ShoppingCart className="w-5 h-5" />
                      استلام نهائي
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2 border-t pt-4 flex flex-row items-center justify-between w-full sm:justify-between">
            <div className="flex-1">
              {viewingOrder?.status !== 'pending' && (
                 <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteOrder(viewingOrder.id)}>
                   <Trash2 className="w-4 h-4 ml-2" />
                   حذف الفاتورة
                 </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => handlePrintOrder(viewingOrder)}>
                 <Printer className="w-4 h-4" />
                 طباعة الفاتورة
              </Button>
              <Button type="button" variant="outline" onClick={() => setViewingOrder(null)} disabled={isSubmitting} className="px-8">إغلاق</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}