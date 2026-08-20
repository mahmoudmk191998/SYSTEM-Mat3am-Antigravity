import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Receipt, Search, FileText, Download, Edit, Trash2, Printer, PieChart as PieChartIcon, Target, Eye, CalendarDays, Tag, Hash, AlignRight } from 'lucide-react';
import { AddExpenseDialog } from '@/components/expenses/AddExpenseDialog';
import { getExpenses, updateExpense, deleteExpense } from '@/services/expenses';
import { useTenantBranch } from '@/hooks/useDatabase';
import type { Expense, ExpenseCategory } from '@/types/expenses';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

// Colors for charts
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const CATEGORIES: ExpenseCategory[] = ['رواتب', 'مشتريات', 'صيانة', 'أخرى'];

export default function Expenses() {
  const { tenantId, branchId } = useTenantBranch();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Date Filtering State
  const [dateRange, setDateRange] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchExpenses = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Fetch all expenses for this tenant
      const data = await getExpenses(tenantId, branchId || undefined);
      setExpenses(data);
    } catch (error) {
      console.error('Failed to load expenses', error);
      toast({ title: 'خطأ', description: 'فشل في تحميل المصروفات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchExpenses();
    }
  }, [tenantId, branchId]); // Re-fetch on mount or tenant/branch change, filters apply in-memory

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      await deleteExpense(id);
      toast({ title: 'تم الحذف', description: 'تم حذف المصروف بنجاح' });
      fetchExpenses();
      setSelectedExpenses(prev => prev.filter(eid => eid !== id));
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedExpenses.length} مصروف؟`)) return;
    try {
      for (const id of selectedExpenses) {
        await deleteExpense(id);
      }
      toast({ title: 'تم الحذف', description: 'تم حذف المصروفات المحددة بنجاح' });
      fetchExpenses();
      setSelectedExpenses([]);
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء حذف المصروفات', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editingExpense) return;
    setIsSubmitting(true);
    try {
      await updateExpense(editingExpense.id, {
        amount: Number(editingExpense.amount),
        category: editingExpense.category,
        description: editingExpense.description,
        date: editingExpense.date,
      });
      toast({ title: 'تم التعديل', description: 'تم تحديث المصروف بنجاح' });
      setEditingExpense(null);
      fetchExpenses();
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء التحديث', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoized Filtered Expenses based on Date and Category constraints
  const filteredAndCategorizedExpenses = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
        
    switch (dateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0); 
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020);
        break;
      case 'custom':
        startDate.setTime(new Date(customStartDate).getTime());
        startDate.setHours(0, 0, 0, 0);
        now.setTime(new Date(customEndDate).getTime());
        now.setHours(23, 59, 59, 999);
        break;
    }

    return expenses.filter(exp => {
      // 1. Search Query Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!exp.description.toLowerCase().includes(query) && 
            !exp.category.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== 'all' && exp.category !== categoryFilter) {
        return false;
      }

      // 3. Date Filter
      if (!exp.date) return false;
      const [year, month, day] = exp.date.split('-');
      // Parse local midnight to avoid timezone shift
      const eDate = new Date(Number(year), Number(month) - 1, Number(day));
      
      if (dateRange === 'yesterday') return eDate >= startDate && eDate < now;
      if (dateRange === 'custom') return eDate >= startDate && eDate <= now;
      return eDate >= startDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, dateRange, customStartDate, customEndDate, searchQuery, categoryFilter]);

  // Statistics
  const totalExpenses = filteredAndCategorizedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Category Pie Chart Data
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredAndCategorizedExpenses.forEach(exp => {
      map.set(exp.category, (map.get(exp.category) || 0) + exp.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort descending
  }, [filteredAndCategorizedExpenses]);

  // Daily Trend Bar Chart Data
  const timelineData = useMemo(() => {
    const map = new Map<string, number>();
    filteredAndCategorizedExpenses.forEach(exp => {
      const d = new Date(exp.date);
      let dateKey = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
      // If single day is selected, maybe show by category instead
      map.set(dateKey, (map.get(dateKey) || 0) + exp.amount);
    });
    const entries = Array.from(map.entries());
    return entries.map(([name, total]) => ({ name, total })).reverse().slice(0, 15).reverse();
  }, [filteredAndCategorizedExpenses]);

  const handleExportCSV = () => {
    const headers = ['التاريخ', 'التصنيف', 'البيان', 'المبلغ'].join(',');
    const rows = filteredAndCategorizedExpenses.map(e => 
      `${e.date},${e.category},"${e.description.replace(/"/g, '""')}",${e.amount}`
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expenses_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MainLayout
      title="إدارة المصروفات"
      subtitle="تتبع وإدارة جميع المصروفات اليومية والشهرية وتحليلها"
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden w-full md:w-auto">
          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue placeholder="التصنيف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] md:w-[150px] bg-background">
              <SelectValue placeholder="اختر الفترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="yesterday">الأمس</SelectItem>
              <SelectItem value="week">آخر 7 أيام</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="year">هذا العام</SelectItem>
              <SelectItem value="all">كل الأوقات</SelectItem>
              <SelectItem value="custom">فترة مخصصة</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1 md:gap-2">
              <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm max-w-[120px]" />
              <span className="text-muted-foreground">-</span>
              <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm max-w-[120px]" />
            </div>
          )}

          {selectedExpenses.length > 0 && (
            <Button onClick={handleBulkDelete} variant="destructive" className="gap-2 shrink-0 hidden sm:flex">
              <Trash2 className="w-4 h-4" />
              حذف ({selectedExpenses.length})
            </Button>
          )}
          <Button variant="outline" className="hidden sm:flex gap-2" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة مصروف
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Top Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{totalExpenses.toLocaleString('ar-EG')} ج.م</div>
                <p className="text-xs text-muted-foreground">للفترة الحالية المحددة</p>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">عدد العمليات</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredAndCategorizedExpenses.length}</div>
                <p className="text-xs text-muted-foreground">عملية إنفاق مسجلة</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">أعلى تصنيف إنفاقاً</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {categoryData.length > 0 ? categoryData[0].name : 'لا يوجد'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {categoryData.length > 0 ? `${categoryData[0].value.toLocaleString('ar-EG')} ج.م` : '-'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">مؤشر المصروفات (التوجهات)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={60} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="total" name="المبلغ" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PieChartIcon className="w-4 h-4" /> توزيع المصروفات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                    لا توجد بيانات كافية
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>سجل المصروفات</CardTitle>
                <CardDescription>عرض تفصيلي لجميع المصروفات ضمن الفترة المحددة</CardDescription>
              </div>
              <div className="flex w-full sm:w-auto gap-2">
                {selectedExpenses.length > 0 && (
                  <Button onClick={handleBulkDelete} variant="destructive" className="gap-2 shrink-0 sm:hidden flex-1">
                    <Trash2 className="w-4 h-4" />
                    حذف المحددة
                  </Button>
                )}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن بيان أو تصنيف..."
                    className="pr-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[40px] px-4">
                      <Checkbox
                        checked={filteredAndCategorizedExpenses.length > 0 && selectedExpenses.length === filteredAndCategorizedExpenses.length}
                        onCheckedChange={(c) => {
                          if (c) setSelectedExpenses(filteredAndCategorizedExpenses.map(e => e.id));
                          else setSelectedExpenses([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead className="w-[40%]">البيان</TableHead>
                    <TableHead className="text-left">المبلغ</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex justify-center items-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredAndCategorizedExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Receipt className="w-5 h-5 opacity-50" />
                          <span>لا توجد مصروفات تطابق شروط البحث والفترة الزمنية</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndCategorizedExpenses.map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="px-4">
                          <Checkbox
                            checked={selectedExpenses.includes(expense.id)}
                            onCheckedChange={(c) => {
                              if (c) setSelectedExpenses(prev => [...prev, expense.id]);
                              else setSelectedExpenses(prev => prev.filter(id => id !== expense.id));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{format(new Date(expense.date), 'dd MMMM yyyy', { locale: ar })}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal bg-opacity-20 border-opacity-20 hover:bg-opacity-30 transition-all">
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{expense.description}</TableCell>
                        <TableCell className="text-left">
                          <span className="font-bold text-destructive">{expense.amount.toLocaleString('ar-EG')} ج.م</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" onClick={() => setViewingExpense(expense)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" onClick={() => setEditingExpense(expense)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" onClick={() => handleDelete(expense.id)}>
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

        {/* Existing Add/Edit Dialogs */}
        <AddExpenseDialog 
          open={isAddDialogOpen} 
          onOpenChange={setIsAddDialogOpen} 
          onSuccess={fetchExpenses} 
        />

        <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>تعديل المصروف</DialogTitle>
            </DialogHeader>
            {editingExpense && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>المبلغ</Label>
                  <Input type="number" step="0.01" value={editingExpense.amount} onChange={(e) => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select value={editingExpense.category} onValueChange={(val: ExpenseCategory) => setEditingExpense({ ...editingExpense, category: val })} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input type="date" value={editingExpense.date} onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>البيان (الوصف)</Label>
                  <Input value={editingExpense.description} onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })} disabled={isSubmitting} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingExpense(null)} disabled={isSubmitting}>إلغاء</Button>
              <Button onClick={handleUpdate} disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={!!viewingExpense} onOpenChange={(open) => !open && setViewingExpense(null)}>
          <DialogContent className="sm:max-w-[420px] overflow-hidden p-0 rounded-2xl border bg-background shadow-2xl">
            {viewingExpense && (
              <div className="flex flex-col relative w-full h-full bg-background">
                {/* Header Section (Receipt Top) */}
                <div className="bg-muted border-b border-dashed border-border px-8 py-8 text-center relative select-none">
                  {/* Decorative Ticket cuts */}
                  <div className="absolute -left-3 -bottom-3 w-6 h-6 bg-background rounded-full border-t border-r border-border rotate-45 z-20" />
                  <div className="absolute -right-3 -bottom-3 w-6 h-6 bg-background rounded-full border-t border-l border-border -rotate-45 z-20" />
                  
                  <div className="w-16 h-16 bg-background rounded-full shadow-sm border border-border mx-auto flex items-center justify-center mb-4 text-foreground relative z-10 text-primary">
                     <Receipt className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 relative z-10">سند صرف / مصروف</h3>
                  <div className="text-4xl font-black text-foreground tracking-tight relative z-10" dir="ltr">
                    <span className="text-xl text-muted-foreground font-bold mr-1">EGP</span>
                    {viewingExpense.amount.toLocaleString('en-US')}
                  </div>
                </div>

                {/* Body Details */}
                <div className="px-8 py-6 space-y-6 bg-background relative z-10 w-full flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground uppercase tracking-wider">
                        <Tag className="w-4 h-4" /> التصنيف
                      </div>
                      <Badge variant="outline" className="font-bold px-3 py-1 bg-primary/10 text-primary border-primary/20 rounded-md text-sm">
                        {viewingExpense.category}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground uppercase tracking-wider">
                        <CalendarDays className="w-4 h-4" /> التاريخ
                      </div>
                      <div className="font-bold text-[15px] text-foreground">
                        {format(new Date(viewingExpense.date), 'dd MMMM yyyy', { locale: ar })}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        <AlignRight className="w-4 h-4" /> البيان / الوصف
                      </div>
                      <div className="bg-muted p-4 rounded-xl border border-border text-[15px] font-bold leading-relaxed text-foreground shadow-sm">
                        {viewingExpense.description}
                      </div>
                    </div>
                  </div>

                  {viewingExpense.shift_id && (
                    <div className="border-t border-border pt-5 mt-2">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground uppercase tracking-wider">
                           <Hash className="w-4 h-4" /> الوردية المتصلة
                         </div>
                         <div className="font-mono text-[13px] font-black px-3 py-1.5 bg-muted rounded-md text-foreground tracking-wider border border-border">
                           #{viewingExpense.shift_id.slice(-8).toUpperCase()}
                         </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Internal ID details */}
                  <div className="text-center pt-4 pb-2">
                     <p className="text-[11px] text-muted-foreground font-mono opacity-60 uppercase tracking-widest font-bold">REF: {viewingExpense.id}</p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="bg-muted/50 p-4 border-t border-border flex items-center gap-3">
                  <Button variant="outline" className="flex-1 font-bold text-[15px]" onClick={() => window.print()}>
                     <Printer className="w-5 h-5 ml-2" /> طباعة الإيصال
                  </Button>
                  <Button 
                     variant="default" 
                     className="w-28 font-bold text-[15px]"
                     onClick={() => setViewingExpense(null)}
                  >
                     إغلاق
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </MainLayout>
  );
}
