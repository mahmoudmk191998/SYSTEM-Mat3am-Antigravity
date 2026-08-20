import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Plus, Edit, Trash2, Search, Eye, Printer, DollarSign, Activity, Users, Wallet, TrendingUp, AlertCircle, Timer, CheckCircle2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { useTenantBranch, useHR } from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/lib/store';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const LiveShiftTimer = ({ startTime }: { startTime: string }) => {
  const [duration, setDuration] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setDuration(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  return <span className="font-mono tabular-nums tracking-wider">{duration}</span>;
};

export default function Shifts() {
  const { branchId, tenantId } = useTenantBranch();
  const { employees: dbEmployees } = useHR(tenantId);
  const { toast } = useToast();
  const { settings } = useAppStore();

  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // POS Shifts State
  const [posShifts, setPosShifts] = useState<any[]>([]);
  const [loadingPosShifts, setLoadingPosShifts] = useState(true);
  const [viewingShift, setViewingShift] = useState<any>(null);
  const [shiftOrders, setShiftOrders] = useState<any[]>([]);
  const [shiftExpenses, setShiftExpenses] = useState<any[]>([]);
  const [loadingShiftDetails, setLoadingShiftDetails] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [employeeName, setEmployeeName] = useState('');
  const [shiftType, setShiftType] = useState('morning');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const printReportRef = useRef<HTMLDivElement>(null);

  const fetchShifts = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'branch_shifts'), where('branch_id', '==', branchId));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      items.sort((a, b) => {
        const d1 = a.created_at ? new Date(a.created_at).getTime() : 0;
        const d2 = b.created_at ? new Date(b.created_at).getTime() : 0;
        return d2 - d1;
      });
      setShifts(items);
    } catch (e) {
      console.error('Error fetching HR shifts:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosShifts = async () => {
    if (!branchId) return;
    setLoadingPosShifts(true);
    try {
      const q = query(collection(db, 'pos_shifts'), where('branch_id', '==', branchId));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Sort descending by start time
      items.sort((a, b) => {
         const t1 = a.start_time ? new Date(a.start_time).getTime() : 0;
         const t2 = b.start_time ? new Date(b.start_time).getTime() : 0;
         return t2 - t1; 
      });
      setPosShifts(items);
    } catch(e) {
      console.error('Error fetching pos shifts', e);
    } finally {
      setLoadingPosShifts(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchPosShifts();
  }, [branchId]);

  const filteredShifts = shifts.filter(s => 
    (s.employee_name || '').includes(searchQuery)
  );
  
  const filteredPosShifts = posShifts.filter(s => 
    (s.cashier_name || '').includes(searchQuery)
  );

  // Analytics Calculations
  const activePosShifts = posShifts.filter(s => s.status === 'active').length;
  
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfToday = startOfToday + 86400000;

  const todayPosShifts = posShifts.filter(s => {
    // Consider a shift "Today's" if it's active, started today, or ended today
    const startTimeTs = s.start_time ? new Date(s.start_time).getTime() : 0;
    const isStartedToday = startTimeTs >= startOfToday && startTimeTs < endOfToday;
    
    const endTimeTs = s.end_time ? new Date(s.end_time).getTime() : 0;
    const isEndedToday = endTimeTs >= startOfToday && endTimeTs < endOfToday;

    return isStartedToday || isEndedToday || s.status === 'active';
  });
  
  const todayTotalCash = todayPosShifts.reduce((sum, s) => {
     // Active shifts might not have actual_cash settled yet, so we use their running cash_sales
     const cash = s.status === 'closed' ? Number(s.actual_cash || 0) : Number(s.cash_sales || 0);
     return sum + cash;
  }, 0);

  const todayTotalSales = todayPosShifts.reduce((sum, s) => {
     const sales = s.total_sales != null ? Number(s.total_sales) : (Number(s.cash_sales) || 0) + (Number(s.card_sales) || 0) + (Number(s.wallet_sales) || 0);
     return sum + sales;
  }, 0);
  
  const todayDiscrepancy = todayPosShifts.reduce((sum, s) => sum + (Number(s.discrepancy) || 0), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName || !startTime || !endTime) return;
    setIsSubmitting(true);
    try {
      const selectedEmp = dbEmployees.find(e => e.name === employeeName);
      await addDoc(collection(db, 'branch_shifts'), {
        branch_id: branchId,
        employee_name: employeeName,
        role: selectedEmp?.role || 'موظف',
        shift_type: shiftType,
        start_time: startTime,
        end_time: endTime,
        created_at: new Date().toISOString()
      });
      toast({ title: 'تمت الإضافة', description: 'تم تسجيل الوردية بنجاح' });
      setIsAddOpen(false);
      setEmployeeName(''); setStartTime(''); setEndTime('');
      fetchShifts();
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء التسجيل', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;
    setIsSubmitting(true);
    try {
      const selectedEmpEdit = dbEmployees.find(e => e.name === editingShift.employee_name);
      await updateDoc(doc(db, 'branch_shifts', editingShift.id), {
        employee_name: editingShift.employee_name,
        role: selectedEmpEdit?.role || editingShift.role || 'موظف',
        shift_type: editingShift.shift_type,
        start_time: editingShift.start_time,
        end_time: editingShift.end_time,
      });
      toast({ title: 'تم التعديل', description: 'تم تحديث الوردية بنجاح' });
      setEditingShift(null);
      fetchShifts();
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء التحديث', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الوردية؟')) return;
    try {
      await deleteDoc(doc(db, 'branch_shifts', id));
      toast({ title: 'تم الحذف', description: 'تم حذف الوردية بنجاح' });
      fetchShifts();
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    }
  };

  const handleDeletePosShift = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف وردية الكاشير هذه بكل بياناتها؟ هذه العملية لا يمكن التراجع عنها.')) return;
    try {
      await deleteDoc(doc(db, 'pos_shifts', id));
      toast({ title: 'تم الحذف', description: 'تم حذف الوردية بنجاح' });
      fetchPosShifts();
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount || 0);
  };
  
  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('ar-EG', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleViewShift = async (shift: any) => {
    setViewingShift(shift);
    setLoadingShiftDetails(true);
    setShiftOrders([]);
    setShiftExpenses([]);
    
    try {
      const ordersQ = query(collection(db, 'orders'), where('shift_id', '==', shift.id));
      const ordersSnap = await getDocs(ordersQ);
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() as any, payments: [] }));

      if (ordersData.length > 0) {
        await Promise.all(ordersData.map(async (o) => {
          const pQ = query(collection(db, 'payments'), where('order_id', '==', o.id));
          const pSnap = await getDocs(pQ);
          o.payments = pSnap.docs.map(d => d.data());
        }));
      }
      setShiftOrders(ordersData);

      const expensesQ = query(collection(db, 'expenses'), where('shift_id', '==', shift.id));
      const expSnap = await getDocs(expensesQ);
      setShiftExpenses(expSnap.docs.map(d => d.data() as any));
    } catch (e) {
      console.error('Error fetching shift details:', e);
    } finally {
      setLoadingShiftDetails(false);
    }
  };

  const confirmedShiftOrders = shiftOrders.filter(o => ['ready', 'completed', 'delivered'].includes(o.status));
  const deliveryCount = confirmedShiftOrders.filter(o => o.order_type === 'delivery').length;
  const takeawayCount = confirmedShiftOrders.filter(o => o.order_type === 'takeaway').length;
  const dineinCount = confirmedShiftOrders.filter(o => o.order_type === 'dine_in').length;
  const totalDeliveryFees = confirmedShiftOrders.reduce((sum, o) => sum + Number(o.delivery_fee || o.deliveryFee || 0), 0);
  
  const handlePrintReport = () => {
    if (!viewingShift) return;
    
    const w = window.open('', '', 'width=400,height=600');
    if (!w) {
      toast({ title: 'خطأ', description: 'الرجاء السماح بالنوافذ المنبثقة للطباعة', variant: 'destructive' });
      return;
    }

    const employeeName = viewingShift.cashier_name || 'موظف غير محدد';
    const shiftTotalSales = viewingShift.total_sales != null ? viewingShift.total_sales : ((viewingShift.cash_sales||0) + (viewingShift.card_sales||0) + (viewingShift.wallet_sales||0));
    const shiftCash = viewingShift.cash_sales || 0;
    const shiftCard = viewingShift.card_sales || 0;
    const shiftWallet = viewingShift.wallet_sales || 0;
    const shiftTotalExpenses = viewingShift.shift_expenses || 0;
    const expectedCash = viewingShift.expected_cash || 0;
    const actualCash = viewingShift.actual_cash || 0;
    const discrepancy = viewingShift.discrepancy || 0;
    const shortageReason = viewingShift.shortage_reason || '';

    const expensesHTML = shiftExpenses.length > 0
      ? shiftExpenses.map(e => `<div class="row"><span>${e.description || 'مصروف'}</span><span>${formatCurrency(Number(e.amount))}</span></div>`).join('')
      : `<div class="row text-center"><span style="color:#666; font-size: 11px;">لا توجد مصروفات</span></div>`;

    w.document.write(`
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', sans-serif; }
            @page { margin: 0; }
              body { width: 100%; max-width: 80mm; padding: 2mm; font-size: 12px; color: #000; background: #fff; margin: 0 auto; -webkit-print-color-adjust: exact; }
            .center { text-align: center; }
            .logo { max-width: 50mm; max-height: 25mm; object-fit: contain; margin-bottom: 8px; }
            h1 { font-size: 18px; margin-bottom: 4px; font-weight: 900; }
            h2 { font-size: 15px; margin-top: 10px; margin-bottom: 5px; font-weight: bold; background: #eee; padding: 2px 5px; border-radius: 4px; border: 1px solid #ccc; text-align: center; }
            .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #ddd; font-weight: 600;}
            .row:last-child { border-bottom: none; }
            .row-bold { display: flex; justify-content: space-between; padding: 5px 0; font-weight: 900; font-size: 14px; border-bottom: 1px solid #000; margin-top: 2px; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            ${settings?.invoiceLogo ? `<img src="${settings.invoiceLogo}" class="logo" />` : ''}
            <h1>${settings?.invoiceCompanyName || 'MK'}</h1>
            <h1 style="border: 2px solid #000; padding: 4px; border-radius: 8px; margin: 8px 0; background: #f9f9f9; font-size: 16px;">تقرير تفصيلي لشيفت المبيعات</h1>
          </div>
          
          <div class="row"><span>وقت الفتح:</span> <span>${viewingShift.start_time ? new Date(viewingShift.start_time).toLocaleString('ar-EG') : '-'}</span></div>
          <div class="row"><span>وقت الإغلاق:</span> <span>${viewingShift.end_time ? new Date(viewingShift.end_time).toLocaleString('ar-EG') : 'مستمرة'}</span></div>
          <div class="row"><span>الموظف:</span> <span>${employeeName}</span></div>
          <div class="row-bold"><span>إجمالي الطلبات المُنفذة:</span> <span>${confirmedShiftOrders.length} طلب</span></div>

          <h2>تفاصيل المبيعات (الدخل)</h2>
          <div class="row"><span>إجمالي قيمة المبيعات:</span> <span>${formatCurrency(shiftTotalSales)}</span></div>
          <div class="row"><span>مدفوعات الكاش:</span> <span>${formatCurrency(shiftCash)}</span></div>
          <div class="row"><span>مدفوعات الشبكة (بطاقة):</span> <span>${formatCurrency(shiftCard)}</span></div>
          <div class="row"><span>مدفوعات المحفظة:</span> <span>${formatCurrency(shiftWallet)}</span></div>

          <h2>أنواع الطلبات المبيعة</h2>
          <div class="row"><span>توصيل (دليفري):</span> <span>${deliveryCount}</span></div>
          <div class="row"><span>استلام (تيك أواي):</span> <span>${takeawayCount}</span></div>
          <div class="row"><span>محلي (صالة):</span> <span>${dineinCount}</span></div>
          
          <h2>المصروفات والسحوبات</h2>
          ${expensesHTML}
          <div class="row-bold"><span>إجمالي المصروفات المسحوبة:</span> <span>${formatCurrency(shiftTotalExpenses)}</span></div>

          <h2>تسوية الدرج والعهد</h2>
          <div class="row"><span>رصيد الدرج الافتتاحي:</span> <span>${formatCurrency(viewingShift.starting_cash || 0)}</span></div>
          ${totalDeliveryFees > 0 ? `<div class="row"><span>رسوم التوصيل المحصلة:</span> <span>${formatCurrency(totalDeliveryFees)}</span></div>` : ''}
          <div class="row-bold"><span>النقد المتوقع بالدرج:</span> <span>${formatCurrency(expectedCash)}</span></div>
          <div class="row" style="margin-top: 5px;"><span>المبلغ الفعلي المُدخل:</span> <span style="font-size: 16px; border: 1px solid #000; padding: 0 4px; border-radius: 4px; font-weight: 900;">${formatCurrency(actualCash)}</span></div>
          <div class="row-bold"><span style="color: ${discrepancy < 0 ? '#ff0000' : 'inherit'};">العجز / الزيادة:</span> <span style="color: ${discrepancy < 0 ? '#ff0000' : 'inherit'};">${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}</span></div>
          ${discrepancy < 0 && shortageReason ? `<div class="row" style="color: #ff0000; border:1px solid #ff0000; padding:4px; margin-top:4px; border-radius:4px; flex-direction: column;">
            <span style="font-size: 10px;">سُجل عجز بالدرج بسبب:</span> 
            <span style="font-weight: normal; margin-top: 2px;">${shortageReason}</span>
          </div>` : ''}

          <div class="line"></div>
          <div class="center" style="margin-top: 25px; margin-bottom: 20px;">
            <p style="font-weight: 900; margin-bottom: 30px; font-size: 14px;">توقيع الكاشير المتسلم / المدير المراجع</p>
            <p style="border-bottom: 1px solid #000; width: 70%; margin: 0 auto;"></p>
          </div>
          <div class="center">
            <p style="margin-top: 10px; font-size: 10px; color: #555;">تم طباعة التقرير بواسطة النظام</p>
          </div>
        </body>
      </html>
    `);
    w.document.close();

    setTimeout(() => {
      w.print();
      w.close();
    }, 500);
  };

  return (
    <MainLayout
      title="إدارة الورديات والكاشير"
      subtitle="مراقبة الورديات النقدية والتقارير المالية ومواعيد الموظفين."
      actions={
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            className="pr-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      }
    >
      <div className="grid gap-6 pb-20">
        
        {/* Analytics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="hover:shadow-md transition-all border-none shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">الورديات المفتوحة</p>
                    <h3 className="text-3xl font-black">{activePosShifts}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform shadow-sm">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="hover:shadow-md transition-all border-none shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">مبيعات ورديات اليوم</p>
                    <h3 className="text-2xl font-black">{formatCurrency(todayTotalSales)}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shadow-sm">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="hover:shadow-md transition-all border-none shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">التحصيل النقدي الفعلي</p>
                    <h3 className="text-2xl font-black">{formatCurrency(todayTotalCash)}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform shadow-sm">
                    <Wallet className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
             <Card className="hover:shadow-md transition-all border-none shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">العجز والزيادة (اليوم)</p>
                    <h3 className={`text-2xl font-black ${todayDiscrepancy < 0 ? 'text-red-500' : todayDiscrepancy > 0 ? 'text-green-500' : ''}`} dir="ltr">
                      {todayDiscrepancy > 0 ? '+' : ''}{formatCurrency(todayDiscrepancy)}
                    </h3>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${
                    todayDiscrepancy < 0 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                      : todayDiscrepancy > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {todayDiscrepancy < 0 ? <AlertCircle className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <Tabs defaultValue="pos_shifts" className="space-y-6">
          <TabsList className="bg-background border">
            <TabsTrigger value="pos_shifts" className="gap-2">
              <DollarSign className="w-4 h-4" /> ورديات الكاشير (النقدية)
            </TabsTrigger>
            <TabsTrigger value="employee_shifts" className="gap-2">
              <Clock className="w-4 h-4" /> مواعيد الموظفين
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos_shifts">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      سجلات ورديات الكاشير المتكاملة
                    </CardTitle>
                    <CardDescription>عرض تقارير الورديات المالية، الزيادات والعجوزات التفصيلية</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الكاشير</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>وقت الفتح</TableHead>
                        <TableHead>وقت الإغلاق</TableHead>
                        <TableHead className="text-right">العهدة (الافتتاحية)</TableHead>
                        <TableHead className="text-right">المبيعات الإجمالية</TableHead>
                        <TableHead className="text-center">العجز / الزيادة</TableHead>
                        <TableHead className="text-center">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPosShifts ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            <div className="flex justify-center items-center">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredPosShifts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-48 text-center bg-gray-50/50 dark:bg-slate-900/20">
                            <div className="flex flex-col flex-1 items-center justify-center p-8 text-muted-foreground">
                              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Wallet className="w-8 h-8 opacity-20" />
                              </div>
                              <p className="text-lg font-bold mb-1">لا توجد ورديات كاشير مسجلة</p>
                              <p className="text-sm">قم بفتح الوردية من نقطة البيع أو ابحث بكلمة أخرى</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPosShifts.map((shift) => {
                           const discrepancy = shift.discrepancy || 0;
                           const isDiscrepancyZero = Math.abs(discrepancy) < 0.01;
                           const discrepancyClass = isDiscrepancyZero 
                              ? 'text-gray-500' 
                              : (discrepancy < 0 ? 'text-red-500 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20' : 'text-green-600 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20');

                           return (
                            <TableRow key={shift.id} className="cursor-pointer hover:bg-muted/30 transition-colors group" onDoubleClick={() => handleViewShift(shift)}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 border-2 border-primary/10 shadow-sm shadow-primary/10">
                                    <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                                      {shift.cashier_name?.substring(0, 2)?.toUpperCase() || 'م'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-bold text-sm tracking-tight">{shift.cashier_name || 'غير محدد'}</p>
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{shift.cashier_role || 'كاشير'}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {shift.status === 'active' ? (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1.5 py-1 px-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-[pulse_1s_ease-in-out_infinite]" /> مفتوحة
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1.5 font-medium py-1 px-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> مغلقة
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-[13px]">{formatDate(shift.start_time)}</span>
                                  {shift.status === 'active' && (
                                     <span className="text-[11px] text-primary flex items-center gap-1 mt-0.5 font-semibold bg-primary/5 px-1 pb-0.5 rounded-sm w-fit border border-primary/10">
                                       <Timer className="w-3 h-3" />
                                       <LiveShiftTimer startTime={shift.start_time} />
                                     </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`text-[13px] ${!shift.end_time ? 'text-muted-foreground italic' : 'font-medium'}`}>
                                  {shift.end_time ? formatDate(shift.end_time) : 'قيد العمل...'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                <span className="bg-secondary/50 px-2 py-1 rounded-md text-[13px] border border-border/50 shadow-inner">{formatCurrency(shift.starting_cash)}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-[14px] text-primary">{formatCurrency(shift.total_sales != null ? shift.total_sales : ((shift.cash_sales||0) + (shift.card_sales||0) + (shift.wallet_sales||0)))}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                {shift.status === 'closed' ? (
                                  <Badge variant="outline" className={`py-1 px-2 text-[12px] tabular-nums font-bold ${discrepancyClass}`}>
                                    <span dir="ltr">{discrepancy > 0 ? '+' : ''}{formatCurrency(discrepancy)}</span>
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs opacity-50 font-bold">---</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary bg-primary/5 hover:bg-primary/20 hover:text-primary transition-colors rounded-full" onClick={(e) => { e.stopPropagation(); handleViewShift(shift); }} title="عرض التقرير المفصل">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-destructive/5 hover:bg-destructive/20 hover:text-destructive transition-colors rounded-full" onClick={(e) => { e.stopPropagation(); handleDeletePosShift(shift.id); }} title="حذف الوردية">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                           );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employee_shifts">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      جدول مواعيد الموظفين
                    </CardTitle>
                    <CardDescription>إضافة وتعديل أوقات الوردية الثابتة للموظفين</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> إضافة موعد وردية
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الموظف</TableHead>
                        <TableHead>نوع الوردية</TableHead>
                        <TableHead>وقت البدء</TableHead>
                        <TableHead>وقت الانتهاء</TableHead>
                        <TableHead className="text-center">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            <div className="flex justify-center items-center">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredShifts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-48 text-center bg-gray-50/50 dark:bg-slate-900/20">
                            <div className="flex flex-col flex-1 items-center justify-center p-8 text-muted-foreground">
                              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Users className="w-8 h-8 opacity-20" />
                              </div>
                              <p className="text-lg font-bold mb-1">لا توجد مواعيد موظفين مسجلة</p>
                              <p className="text-sm">أضف وردية موظف جديدة أو غيّر كلمات البحث</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredShifts.map((shift) => (
                          <TableRow key={shift.id} className="group hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border-2 border-primary/10 shadow-sm shadow-primary/10">
                                  <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                                    {shift.employee_name?.substring(0, 2)?.toUpperCase() || 'م'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-bold text-sm tracking-tight">{shift.employee_name || 'غير محدد'}</p>
                                  <p className="text-[10px] text-muted-foreground">{shift.role || 'موظف'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                                {shift.shift_type === 'morning' ? 'صباحية' : shift.shift_type === 'evening' ? 'مسائية' : 'ليلية'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-[13px]">{shift.start_time}</TableCell>
                            <TableCell>
                              <span className={`text-[13px] ${!shift.end_time ? 'text-muted-foreground italic' : 'font-medium'}`}>
                                {shift.end_time || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors rounded-full" onClick={() => setEditingShift(shift)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-destructive/5 hover:bg-destructive/20 hover:text-destructive transition-colors rounded-full" onClick={() => handleDelete(shift.id)}>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* POS Shift Details Dialog (Z-Report) */}
      <Dialog open={!!viewingShift} onOpenChange={(open) => !open && setViewingShift(null)}>
        <DialogContent className="max-w-[480px] w-[95%] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl bg-white dark:bg-slate-950">
          <div className="flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 dark:bg-slate-900 border-b p-4 flex justify-between items-center z-10 sticky top-0 shadow-sm print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none">تقرير التقفيل النهائي (Z-Report)</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">تفاصيل وحالة الوردية</p>
                </div>
              </div>
              <Badge variant={viewingShift?.status === 'active' ? 'default' : 'secondary'} className={viewingShift?.status === 'active' ? 'bg-green-500' : ''}>
                {viewingShift?.status === 'active' ? 'مفتوحة الآن' : 'مغلقة'}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto w-full p-6 custom-scrollbar" dir="rtl">
            {loadingShiftDetails ? (
              <div className="p-12 flex flex-col justify-center items-center w-full min-h-[400px]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-muted-foreground animate-pulse">جاري سحب بيانات تقرير الوردية...</p>
              </div>
            ) : (
           <div className="flex flex-col gap-6" dir="rtl">
              <div className="text-center">
                <h1 className="text-xl font-black mb-1">{settings?.invoiceCompanyName || 'MK'}</h1>
                <p className="text-sm text-muted-foreground">الكاشير: <span className="font-bold text-foreground">{viewingShift?.cashier_name || 'غير محدد'}</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border">
                    <p className="text-xs text-muted-foreground mb-1">وقت الفتح</p>
                    <p className="text-sm font-bold">{viewingShift?.start_time ? new Date(viewingShift.start_time).toLocaleString('ar-EG') : '-'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border">
                    <p className="text-xs text-muted-foreground mb-1">وقت الإغلاق</p>
                    {viewingShift?.status === 'active' ? (
                       <div className="text-sm font-bold text-primary flex items-center gap-1.5"><Timer className="w-3.5 h-3.5"/> <LiveShiftTimer startTime={viewingShift.start_time} /></div>
                    ) : (
                       <p className="text-sm font-bold">{viewingShift?.end_time ? new Date(viewingShift.end_time).toLocaleString('ar-EG') : '-'}</p>
                    )}
                  </div>
              </div>

              <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> الدخل التفصيلي</h3>
                    <div className="space-y-2 text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border">
                        <div className="flex justify-between py-1.5 border-b border-border/50 border-dashed">
                          <span className="text-muted-foreground">العهدة الافتتاحية (المستلمة):</span>
                          <span className="font-medium">{formatCurrency(viewingShift?.starting_cash || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50 border-dashed">
                          <span className="text-muted-foreground">المبيعات النقدية (كاش):</span>
                          <span className="font-medium text-green-600">+ {formatCurrency(viewingShift?.cash_sales || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50 border-dashed">
                          <span className="text-muted-foreground">مبيعات البطاقات (شبكة):</span>
                          <span className="font-medium text-blue-600">{formatCurrency(viewingShift?.card_sales || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50 border-dashed">
                          <span className="text-muted-foreground">مبيعات إلكترونية (تطبيقات):</span>
                          <span className="font-medium text-purple-600">{formatCurrency(viewingShift?.wallet_sales || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2 mt-1">
                          <span className="font-bold">إجمالي المبيعات (بدون التوصيل):</span>
                          <span className="font-bold">{formatCurrency(viewingShift?.total_sales != null ? viewingShift.total_sales : ((viewingShift?.cash_sales || 0) + (viewingShift?.card_sales || 0) + (viewingShift?.wallet_sales || 0)))}</span>
                        </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> تفاصيل الطلبات ({confirmedShiftOrders.length})</h3>
                    <div className="flex gap-2">
                       <span className="flex-1 bg-slate-50 dark:bg-slate-900/50 text-center text-xs py-2 rounded-lg border">
                          دليفري: <b>{deliveryCount}</b>
                       </span>
                       <span className="flex-1 bg-slate-50 dark:bg-slate-900/50 text-center text-xs py-2 rounded-lg border">
                          تيك أواي: <b>{takeawayCount}</b>
                       </span>
                       <span className="flex-1 bg-slate-50 dark:bg-slate-900/50 text-center text-xs py-2 rounded-lg border">
                          صالة: <b>{dineinCount}</b>
                       </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> المصروفات والسحوبات <span className="text-xs font-normal bg-secondary px-2 rounded-full mr-auto">{shiftExpenses.length} عناصر</span></h3>
                    <div className="space-y-2 text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border">
                        {shiftExpenses.length > 0 ? (
                          shiftExpenses.map((e, idx) => (
                            <div key={idx} className="flex justify-between py-1 border-b border-border/50 border-dashed last:border-0 pl-1 pr-1">
                              <span className="text-muted-foreground">{e.description || 'مصروف'}</span>
                              <span>{formatCurrency(Number(e.amount))}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-2 text-muted-foreground text-xs">لا توجد مصروفات سجلت في هذه الوردية</div>
                        )}
                        {shiftExpenses.length > 0 && (
                          <div className="flex justify-between py-2 border-t font-bold mt-1">
                            <span>إجمالي المصروفات:</span>
                            <span className="text-red-500">- {formatCurrency(viewingShift?.shift_expenses || 0)}</span>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> تسوية الدرج (النقدية فقط)</h3>
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
                      <div className="flex justify-between py-1 mb-2">
                         <span className="font-medium">المتوقع بالدرج:</span>
                         <span className="font-bold">{formatCurrency(viewingShift?.expected_cash || 0)}</span>
                      </div>
                      
                      {viewingShift?.status === 'closed' && (
                        <>
                          <div className="flex justify-between items-center py-2 border-t border-primary/20 mt-1 mb-2">
                            <span className="font-medium text-sm">تم تسليمه فعلياً:</span>
                            <span className="text-lg bg-white dark:bg-black px-3 py-1 rounded shadow-sm border font-black">{formatCurrency(viewingShift?.actual_cash || 0)}</span>
                          </div>
                          <div className={`flex justify-between items-center p-3 rounded-lg border ${
                            (viewingShift?.discrepancy || 0) < 0 ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800' : 
                            (viewingShift?.discrepancy || 0) > 0 ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800' : 
                            'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 text-foreground'
                          }`}>
                            <div className="flex items-center gap-2">
                               {(viewingShift?.discrepancy || 0) < 0 ? <AlertCircle className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
                               <span className="font-bold text-sm">
                                  {(viewingShift?.discrepancy || 0) < 0 ? 'عجز نقدي بالوردية' : (viewingShift?.discrepancy || 0) > 0 ? 'زيادة نقدية مع الكاشير' : 'مطابق تماماً'}
                               </span>
                            </div>
                            <span className="font-black" dir="ltr">{(viewingShift?.discrepancy || 0) > 0 ? '+' : ''}{formatCurrency(viewingShift?.discrepancy || 0)}</span>
                          </div>
                          {(viewingShift?.discrepancy || 0) < 0 && viewingShift?.shortage_reason && (
                            <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2.5 rounded border border-red-100 dark:border-red-900/50">
                              <span className="font-bold mb-1 block">سبب العجز المسجل:</span>
                              {viewingShift.shortage_reason}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
              </div>
           </div>
           )}
           </div>
           
           <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex gap-3 print:hidden">
              <Button onClick={() => setViewingShift(null)} variant="outline" className="flex-1">إغلاق</Button>
              <Button onClick={handlePrintReport} className="gap-2 flex-1"><Printer className="w-4 h-4"/> طباعة إيصال التقفيل</Button>
           </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Employee Shift Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>إضافة وردية موظف جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم الموظف *</Label>
                <Select required value={employeeName} onValueChange={setEmployeeName} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                  <SelectContent>
                    {dbEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.name}>{emp.name} - ({emp.role || 'موظف'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>نوع الوردية</Label>
                <Select value={shiftType} onValueChange={setShiftType} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">صباحية</SelectItem>
                    <SelectItem value="evening">مسائية</SelectItem>
                    <SelectItem value="night">ليلية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>وقت البدء *</Label>
                  <Input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>وقت الانتهاء *</Label>
                  <Input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} disabled={isSubmitting} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>إلغاء</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Shift Dialog */}
      <Dialog open={!!editingShift} onOpenChange={(open) => !open && setEditingShift(null)}>
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>تعديل الوردية</DialogTitle>
            </DialogHeader>
            {editingShift && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الموظف *</Label>
                  <Select required value={editingShift.employee_name} onValueChange={val => setEditingShift({...editingShift, employee_name: val})} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {dbEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.name}>{emp.name} - ({emp.role || 'موظف'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نوع الوردية</Label>
                  <Select value={editingShift.shift_type} onValueChange={v => setEditingShift({...editingShift, shift_type: v})} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">صباحية</SelectItem>
                      <SelectItem value="evening">مسائية</SelectItem>
                      <SelectItem value="night">ليلية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>وقت البدء *</Label>
                    <Input type="time" required value={editingShift.start_time} onChange={e => setEditingShift({...editingShift, start_time: e.target.value})} disabled={isSubmitting} />
                  </div>
                  <div className="space-y-2">
                    <Label>وقت الانتهاء *</Label>
                    <Input type="time" required value={editingShift.end_time || ''} onChange={e => setEditingShift({...editingShift, end_time: e.target.value})} disabled={isSubmitting} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingShift(null)} disabled={isSubmitting}>إلغاء</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التحديث'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
