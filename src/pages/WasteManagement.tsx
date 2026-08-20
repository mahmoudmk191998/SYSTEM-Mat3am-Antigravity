import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Plus, Edit, Search, DollarSign, FileDown, Printer, Filter, Calendar, AlertTriangle, PackageX } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTenantBranch, useInventoryItems, useStockMovements } from '@/hooks/useDatabase';
import { useUserPermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

export default function WasteManagement() {
  const { tenantId, branchId } = useTenantBranch();
  const { hasPermission, isAdmin } = useUserPermissions();
  const { items: inventoryItems } = useInventoryItems(tenantId);
  const { movements, addMovement, updateMovement, deleteMovement, loading } = useStockMovements(branchId);
  const { toast } = useToast();

  const canEdit = isAdmin || hasPermission('inventory.edit');
  const canDelete = isAdmin || hasPermission('inventory.delete');

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('spoilage');
  const [notes, setNotes] = useState('');

  const filteredRecords = useMemo(() => {
    return movements
      .filter(m => m.movement_type === 'waste')
      .filter(r => {
        if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;
        
        if (dateFilter !== 'all') {
          const date = parseISO(r.created_at);
          if (dateFilter === 'today' && !isToday(date)) return false;
          if (dateFilter === 'yesterday' && !isYesterday(date)) return false;
          if (dateFilter === 'week' && !isThisWeek(date)) return false;
          if (dateFilter === 'month' && !isThisMonth(date)) return false;
        }

        if (searchQuery) {
          const s = searchQuery.toLowerCase();
          const itemName = inventoryItems.find((i: any) => i.id === r.item_id)?.name?.toLowerCase() || '';
          const recordNotes = (r.notes || '').toLowerCase();
          return itemName.includes(s) || recordNotes.includes(s);
        }

        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // Sort newest first
  }, [movements, reasonFilter, dateFilter, searchQuery, inventoryItems]);

  const stats = useMemo(() => {
    let totalScore = 0;
    let totalQty = 0;
    const itemsMap: Record<string, { qty: number; cost: number; name: string }> = {};

    filteredRecords.forEach((record) => {
      const item = inventoryItems.find((i: any) => i.id === record.item_id);
      const costPerUnit = item ? (Number(item.cost_per_unit) || 0) : 0;
      const qty = Math.abs(Number(record.quantity));
      const lineCost = qty * costPerUnit;

      totalScore += lineCost;
      totalQty += qty;

      if (!itemsMap[record.item_id]) {
        itemsMap[record.item_id] = { qty: 0, cost: 0, name: item?.name || 'غير معروف' };
      }
      itemsMap[record.item_id].qty += qty;
      itemsMap[record.item_id].cost += lineCost;
    });

    let topWastedItem = null;
    let maxCost = -1;
    Object.values(itemsMap).forEach(v => {
      if (v.cost > maxCost) {
        maxCost = v.cost;
        topWastedItem = v;
      }
    });

    return {
      totalCost: totalScore,
      totalQty,
      topItem: topWastedItem
    };
  }, [filteredRecords, inventoryItems]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !quantity) return;
    setIsSubmitting(true);
    
    const qty = Math.abs(Number(quantity)); // Ensure it's positive before negating
    const success = await addMovement({
      item_id: itemId,
      movement_type: 'waste',
      quantity: -qty, // Negative quantity perfectly reduces inventory generic logic
      reason,
      notes,
    });

    if (success) {
      toast({ title: 'تمت الإضافة', description: 'تم تسجيل الهالك بنجاح' });
      setIsAddOpen(false);
      setItemId(''); setQuantity(''); setNotes('');
    } else {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء التسجيل', variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editingRecord.item_id || !editingRecord.quantity) return;
    setIsSubmitting(true);
    
    const qty = -Math.abs(Number(editingRecord.quantity)); // Negative because it's waste
    const success = await updateMovement(
      editingRecord.id, 
      editingRecord._original, 
      { ...editingRecord, quantity: qty }
    );

    if (success) {
      toast({ title: 'تم التحديث', description: 'تم تحديث سجل الهالك بنجاح' });
      setIsEditOpen(false);
      setEditingRecord(null);
    } else {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء التحديث', variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (record: any) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟ سيتم إعادة الكمية المخصومة إلى المخزون.')) return;
    const success = await deleteMovement(record.id, record.item_id, record.quantity);
    if (success) {
      toast({ title: 'تم الحذف', description: 'تم حذف السجل واسترجاع الكمية إلى المخزون بنجاح' });
    } else {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    }
  };

  const getItemName = (id: string) => inventoryItems.find((i: any) => i.id === id)?.name || 'غير معروف';

  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      toast({ title: 'لا يوجد بيانات', description: 'قم بتغيير الفلاتر لعرض بيانات للتصدير', variant: 'destructive' });
      return;
    }

    const headers = ['التاريخ', 'الصنف', 'الكمية المهدرة', 'السبب', 'التكلفة الإجمالية'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => {
        const item = inventoryItems.find((i: any) => i.id === r.item_id);
        const costPerUnit = item ? (Number(item.cost_per_unit) || 0) : 0;
        const totalLineCost = costPerUnit * Math.abs(Number(r.quantity));
        const reasonStr = r.reason === 'spoilage' ? 'تلف / انتهاء صلاحية' :
                          r.reason === 'mistake' ? 'خطأ تشغيلي أو سقوط' :
                          r.reason ? 'أخرى' : 'مسجلة من المخزون العام';
        
        return `"${new Date(r.created_at).toLocaleDateString('ar-EG')}","${item?.name || 'غير معروف'}",${Math.abs(Number(r.quantity))},"${reasonStr}",${totalLineCost.toFixed(2)}`;
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `waste-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MainLayout
      title="إدارة الهالك والتوالف"
      subtitle="تسجيل المواد التالفة أو الهالكة وخصمها من المخزون مع ذكر الأسباب."
      actions={
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          تسجيل هالك
        </Button>
      }
    >
      <div className="grid gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           <Card className="bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-background border-rose-100 dark:border-rose-900/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
             <CardContent className="p-6 flex items-center gap-4">
               <div className="p-4 bg-rose-100 dark:bg-rose-900/40 rounded-2xl text-rose-600 dark:text-rose-400 shadow-inner">
                 <DollarSign className="w-7 h-7" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-muted-foreground mb-1">إجمالي تكلفة التوالف</p>
                 <h3 className="text-3xl font-black text-foreground">{formatCurrency(stats.totalCost)}</h3>
               </div>
             </CardContent>
           </Card>

           <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-100 dark:border-amber-900/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
             <CardContent className="p-6 flex items-center gap-4">
               <div className="p-4 bg-amber-100 dark:bg-amber-900/40 rounded-2xl text-amber-600 dark:text-amber-400 shadow-inner">
                 <AlertTriangle className="w-7 h-7" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-muted-foreground mb-1">أكثر صنف إهداراً (تكلفةً)</p>
                 <h3 className="text-xl font-bold text-foreground truncate max-w-[150px]">
                   {stats.topItem ? stats.topItem.name : 'لا يوجد'}
                 </h3>
                 {stats.topItem && <p className="text-xs font-bold text-muted-foreground mt-1">{formatCurrency(stats.topItem.cost)}</p>}
               </div>
             </CardContent>
           </Card>

           <Card className="bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-background border-sky-100 dark:border-sky-900/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
             <CardContent className="p-6 flex items-center gap-4">
               <div className="p-4 bg-sky-100 dark:bg-sky-900/40 rounded-2xl text-sky-600 dark:text-sky-400 shadow-inner">
                 <PackageX className="w-7 h-7" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-muted-foreground mb-1">إجمالي الكمية المُهدرة</p>
                 <h3 className="text-3xl font-black text-foreground">{stats.totalQty.toFixed(2)}</h3>
               </div>
             </CardContent>
           </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  سجل الهالك المفلتر
                </CardTitle>
                <CardDescription>عرض العمليات الخاصة بالهالك بناءً على الفلاتر</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                <div className="relative w-[140px] xl:w-40">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="h-9">
                      <Calendar className="w-4 h-4 ml-2 text-muted-foreground" />
                      <SelectValue placeholder="الفترة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="today">اليوم</SelectItem>
                      <SelectItem value="yesterday">الأمس</SelectItem>
                      <SelectItem value="week">هذا الأسبوع</SelectItem>
                      <SelectItem value="month">هذا الشهر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative w-[150px] xl:w-44">
                  <Select value={reasonFilter} onValueChange={setReasonFilter}>
                    <SelectTrigger className="h-9">
                      <Filter className="w-4 h-4 ml-2 text-muted-foreground" />
                      <SelectValue placeholder="السبب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأسباب</SelectItem>
                      <SelectItem value="spoilage">تلف / انتهاء صلاحية</SelectItem>
                      <SelectItem value="mistake">خطأ تشغيلي</SelectItem>
                      <SelectItem value="other">أسباب أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative flex-grow sm:w-60 xl:w-64">
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في السجلات..."
                    className="pr-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Button variant="outline" size="icon" onClick={exportToCSV} title="تصدير CSV" className="h-9 w-9 shrink-0">
                  <FileDown className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.print()} title="طباعة" className="h-9 w-9 shrink-0">
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الكمية المهدرة</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead>إجمالي التكلفة</TableHead>
                    <TableHead className="w-24 text-left">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex justify-center items-center">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        لا يوجد سجلات تطابق عوامل التصفية الحالية
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => {
                      const item = inventoryItems.find((i: any) => i.id === record.item_id);
                      const costPerUnit = item ? (Number(item.cost_per_unit) || 0) : 0;
                      const lineCost = Math.abs(record.quantity) * costPerUnit;

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(record.created_at).toLocaleDateString('ar-EG')}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{item?.name || 'غير معروف'}</TableCell>
                          <TableCell className="font-bold flex items-center gap-1">
                            {Math.abs(record.quantity)}
                            <span className="text-xs font-normal text-muted-foreground">{item?.unit}</span>
                          </TableCell>
                          <TableCell>
                            {!record.reason || record.reason === 'spoilage' ? (
                              <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200">تلف / انتهاء صلاحية</Badge>
                            ) : record.reason === 'mistake' ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">خطأ تشغيلي</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">أسباب أخرى</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-destructive">{formatCurrency(lineCost)}</TableCell>
                          <TableCell className="text-left">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditingRecord({ ...record, quantity: Math.abs(record.quantity), _original: record }); setIsEditOpen(true); }}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(record)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">ملاحظة: سجل الهالك مرتبط بارتباط وثيق بالمخزون. يمكنك الآن تعديل أو حذف السجل وسينعكس ذلك على الرصيد الفعلي للمخزون.</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>تسجيل هالك جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الصنف *</Label>
                <Select value={itemId} onValueChange={setItemId} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="اختر صنفاً" /></SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الكمية المطلوبة للخصم *</Label>
                <Input type="number" step="0.01" required value={quantity} onChange={e => setQuantity(e.target.value)} disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label>السبب</Label>
                <Select value={reason} onValueChange={setReason} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spoilage">تلف / انتهاء صلاحية</SelectItem>
                    <SelectItem value="mistake">خطأ تشغيلي أو سقوط</SelectItem>
                    <SelectItem value="other">أسباب أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات إضافية (اختياري)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={isSubmitting} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>إلغاء</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ والخصم...' : 'حفظ'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if(!open) setEditingRecord(null); }}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>تعديل سجل هالك</DialogTitle>
            </DialogHeader>
            {editingRecord && (
              <div className="space-y-4 py-4">
                <div className="space-y-2 text-muted-foreground bg-muted/30 p-2 rounded-md">
                  <Label>الصنف: </Label> {getItemName(editingRecord.item_id)}
                </div>
                <div className="space-y-2">
                  <Label>الكمية المطلوبة للخصم *</Label>
                  <Input type="number" step="0.01" min={0.01} required value={editingRecord.quantity} onChange={e => setEditingRecord((f: any) => ({ ...f, quantity: e.target.value }))} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>السبب</Label>
                  <Select value={editingRecord.reason || 'spoilage'} onValueChange={v => setEditingRecord((f: any) => ({ ...f, reason: v }))} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spoilage">تلف / انتهاء صلاحية</SelectItem>
                      <SelectItem value="mistake">خطأ تشغيلي أو سقوط</SelectItem>
                      <SelectItem value="other">أسباب أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات إضافية</Label>
                  <Textarea value={editingRecord.notes || ''} onChange={e => setEditingRecord((f: any) => ({ ...f, notes: e.target.value }))} disabled={isSubmitting} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingRecord(null); }} disabled={isSubmitting}>إلغاء</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'جاري التحديث...' : 'تحديث'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
