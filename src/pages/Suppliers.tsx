import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Plus, Edit, Trash2, Search, Briefcase, Mail, Phone, MapPin, Tag, Package, FileText, CheckCircle2, XCircle, TrendingUp, DollarSign, Building2, Eye, Truck } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { useSuppliers, usePurchaseOrders, useTenantBranch } from '@/hooks/useDatabase';

export default function Suppliers() {
  const { tenantId } = useTenantBranch();
  const { suppliers, loading, add, update, remove } = useSuppliers(tenantId);
  const { orders } = usePurchaseOrders(tenantId); // Fetch purchase orders to compute stats

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [viewingSupplier, setViewingSupplier] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    taxId: '',
    address: '',
    category: 'مواد غذائية',
    status: 'active',
    notes: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      phone: '',
      email: '',
      taxId: '',
      address: '',
      category: 'مواد غذائية',
      status: 'active',
      notes: ''
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.phone || '').includes(searchQuery);
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [suppliers, searchQuery, filterStatus]);

  // Analytics
  const activeSuppliersCount = suppliers.filter(s => s.status === 'active').length;
  const totalPurchaseValue = useMemo(() => {
    return orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
  }, [orders]);

  const supplierStats = useMemo(() => {
    const stats: Record<string, { totalAmount: number, orderCount: number }> = {};
    orders.forEach(order => {
      if (!stats[order.supplier_id]) {
        stats[order.supplier_id] = { totalAmount: 0, orderCount: 0 };
      }
      stats[order.supplier_id].totalAmount += (Number(order.total_amount) || 0);
      stats[order.supplier_id].orderCount += 1;
    });
    return stats;
  }, [orders]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    const success = await add({ 
      ...formData,
      created_at: new Date().toISOString()
    });
    if (success) {
      setIsAddDialogOpen(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const openEditDialog = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      company: supplier.company || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      taxId: supplier.taxId || '',
      address: supplier.address || '',
      category: supplier.category || 'مواد غذائية',
      status: supplier.status || 'active',
      notes: supplier.notes || ''
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !formData.name) return;
    setIsSubmitting(true);
    const success = await update(editingSupplier.id, {
      ...formData,
      updated_at: new Date().toISOString()
    });
    if (success) {
      setEditingSupplier(null);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المورد "${name}" نهائياً من النظام؟`)) {
      await remove(id);
      if (viewingSupplier?.id === id) setViewingSupplier(null);
    }
  };

  const handleBulkDeleteSuppliers = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedSuppliers.length} مورد؟`)) return;
    for (const id of selectedSuppliers) {
      await remove(id);
    }
    setSelectedSuppliers([]);
  };

  return (
    <MainLayout
      title="إدارة الموردين"
      subtitle="سجل شامل لبيانات الموردين والمقاولين وإدارة التعاملات المالية"
      actions={
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} className="gap-2 shadow-md">
          <Plus className="w-4 h-4" />
          مورد جديد
        </Button>
      }
    >
      <div className="grid gap-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي الموردين</p>
                  <p className="text-3xl font-bold">{suppliers.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">الموردين النشطين</p>
                  <p className="text-3xl font-bold text-emerald-600">{activeSuppliersCount}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">إجمالي تعاملات الشراء</p>
                  <p className="text-3xl font-bold text-blue-600">{totalPurchaseValue.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="shadow-sm border-0 border-t-4 border-t-primary">
          <CardHeader className="bg-card pb-4 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Users className="w-6 h-6 text-primary" />
                  قاعدة بيانات الموردين
                </CardTitle>
                <CardDescription className="text-base mt-2">عرض وتصنيف كافة الموردين المرتبطين بالمطعم والمخازن</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {selectedSuppliers.length > 0 && (
                  <Button onClick={handleBulkDeleteSuppliers} variant="destructive" className="gap-2 shrink-0 md:mr-auto">
                    <Trash2 className="w-4 h-4" />
                    حذف ({selectedSuppliers.length})
                  </Button>
                )}
                <div className="relative w-full sm:w-80">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث باسم المورد أو الشركة أو الهاتف..."
                  className="pr-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="all" className="w-full" onValueChange={setFilterStatus}>
              <TabsList className="mb-6 h-10">
                <TabsTrigger value="all" className="px-6">الكل</TabsTrigger>
                <TabsTrigger value="active" className="px-6 text-emerald-600 data-[state=active]:bg-emerald-50">نشط</TabsTrigger>
                <TabsTrigger value="inactive" className="px-6 text-rose-600 data-[state=active]:bg-rose-50">غير نشط</TabsTrigger>
              </TabsList>
              
              <div className="rounded-lg border border-border/50 overflow-x-auto shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[40px] px-4">
                         <Checkbox
                           checked={filteredSuppliers.length > 0 && selectedSuppliers.length === filteredSuppliers.length}
                           onCheckedChange={(c) => {
                             if (c) setSelectedSuppliers(filteredSuppliers.map(su => su.id));
                             else setSelectedSuppliers([]);
                           }}
                         />
                      </TableHead>
                      <TableHead className="font-semibold px-4 w-1/4">المورد / الشركة</TableHead>
                      <TableHead className="font-semibold">التصنيف</TableHead>
                      <TableHead className="font-semibold">معلومات التواصل</TableHead>
                      <TableHead className="font-semibold text-center">الحالة</TableHead>
                      <TableHead className="font-semibold text-center">أوامر الشراء</TableHead>
                      <TableHead className="text-center font-semibold w-[120px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <div className="flex justify-center items-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredSuppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          لا يوجد موردين مطابقين للبحث
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <TableRow key={supplier.id} className="hover:bg-muted/10 group">
                          <TableCell className="px-4">
                            <div onClick={e => e.stopPropagation()}>
                              <Checkbox 
                                checked={selectedSuppliers.includes(supplier.id)}
                                onCheckedChange={(c) => {
                                  if (c) setSelectedSuppliers(prev => [...prev, supplier.id]);
                                  else setSelectedSuppliers(prev => prev.filter(id => id !== supplier.id));
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Truck className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-bold text-base">{supplier.name}</p>
                                {supplier.company && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Briefcase className="w-3 h-3" />
                                    {supplier.company}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-background">
                              {supplier.category || 'غير محدد'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {supplier.phone ? (
                                <p className="text-sm flex items-center gap-1.5" dir="ltr">
                                  <Phone className="w-3" />
                                  <span className="text-right w-full">{supplier.phone}</span>
                                </p>
                              ) : <span className="text-muted-foreground text-xs">-</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                             {supplier.status === 'inactive' ? (
                               <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200">غير نشط</Badge>
                             ) : (
                               <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">نشط</Badge>
                             )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-lg text-primary">{supplierStats[supplier.id]?.orderCount || 0}</span>
                              <span className="text-xs text-muted-foreground">طلبات</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10" 
                                onClick={() => setViewingSupplier(supplier)} title="عرض الملف">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-500/10" 
                                onClick={() => openEditDialog(supplier)} title="تعديل">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" 
                                onClick={() => handleDelete(supplier.id, supplier.name)} title="حذف">
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

      {/* Add / Edit Supplier Dialog */}
      <Dialog open={isAddDialogOpen || !!editingSupplier} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingSupplier(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <form onSubmit={editingSupplier ? handleUpdate : handleAdd}>
            <DialogHeader className="border-b pb-4 mb-4">
              <DialogTitle className="text-2xl flex items-center gap-2">
                {editingSupplier ? <Edit className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
                {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </DialogTitle>
              <DialogDescription className="text-base">
                أدخل كافة تفاصيل المورد والشركة لسهولة التواصل وتسجيل الفواتير.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المورد (أو المسؤول) <span className="text-red-500">*</span></Label>
                  <Input required placeholder="مثال: محمد أحمد" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>اسم الشركة / المؤسسة</Label>
                  <Input placeholder="مثال: شركة المراعي" value={formData.company} onChange={e => handleInputChange('company', e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label>تصنيف المورد</Label>
                  <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                    <SelectTrigger>
                       <SelectValue placeholder="اختر التصنيف..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="مواد غذائية">مواد غذائية ومشروبات</SelectItem>
                      <SelectItem value="لحوم ودواجن">لحوم ودواجن</SelectItem>
                      <SelectItem value="تغليف وتعبئة">تغليف وتعبئة (مستهلكات)</SelectItem>
                      <SelectItem value="معدات وصيانة">معدات وصيانة</SelectItem>
                      <SelectItem value="أخرى">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>حالة المورد</Label>
                  <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                    <SelectTrigger>
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط (يتعامل معه)</SelectItem>
                      <SelectItem value="inactive">غير نشط (متوقف)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                 <h4 className="font-semibold flex items-center gap-2 mb-2"><Phone className="w-4 h-4"/> بيانات التواصل والضريبة</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input placeholder="01xxxxxxxxx" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} disabled={isSubmitting} dir="ltr" className="text-right" />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input type="email" placeholder="email@company.com" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} disabled={isSubmitting} dir="ltr" className="text-right" />
                  </div>
                  <div className="space-y-2">
                    <Label>الرقم الضريبي (للفواتير)</Label>
                    <Input placeholder="123-456-789" value={formData.taxId} onChange={e => handleInputChange('taxId', e.target.value)} disabled={isSubmitting} dir="ltr" className="text-right" />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان الفعلي</Label>
                    <Input placeholder="أدخل العنوان بالتفصيل" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} disabled={isSubmitting} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات إضافية</Label>
                <Input placeholder="أي معلومات تهمك مثل: موعد التوصيل، طرق الدفع المفضلة..." value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} disabled={isSubmitting} />
              </div>
            </div>
            
            <DialogFooter className="mt-6 border-t pt-4">
              <Button type="button" variant="outline" className="px-8" onClick={() => {setIsAddDialogOpen(false); setEditingSupplier(null);}} disabled={isSubmitting}>إلغاء</Button>
              <Button type="submit" disabled={isSubmitting} className="px-8 shadow-sm">{isSubmitting ? 'جاري الحفظ...' : (editingSupplier ? 'حفظ التحديثات' : 'إضافة المورد')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Full Profile / View Dialog */}
      <Dialog open={!!viewingSupplier} onOpenChange={(open) => !open && setViewingSupplier(null)}>
        <DialogContent className="max-w-3xl rounded-xl p-0 overflow-hidden">
          {viewingSupplier && (
            <div className="flex flex-col">
              <div className="bg-primary/5 p-6 border-b flex justify-between items-start">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <Building2 className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{viewingSupplier.name}</h2>
                      {viewingSupplier.company && <p className="text-lg text-muted-foreground">{viewingSupplier.company}</p>}
                    </div>
                 </div>
                 {viewingSupplier.status === 'inactive' ? (
                    <Badge variant="outline" className="text-rose-600 bg-rose-50 border-rose-200 px-3 py-1">توقف التعامل</Badge>
                 ) : (
                    <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200 px-3 py-1">يتعامل معه (نشط)</Badge>
                 )}
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3 border-b pb-2"><FileText className="w-5 h-5"/> التوصيف المالي</h3>
                    <div className="space-y-4 bg-muted/20 p-4 rounded-xl border">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">عدد أوامر الشراء</span>
                        <span className="font-bold text-xl">{supplierStats[viewingSupplier.id]?.orderCount || 0}</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-muted-foreground">حجم التعامل الإجمالي</span>
                        <span className="font-bold text-2xl text-primary font-mono select-all">
                          {(supplierStats[viewingSupplier.id]?.totalAmount || 0).toLocaleString('ar-EG', {minimumFractionDigits: 2})} <span className="text-sm">ج.م</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {viewingSupplier.notes && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-2 text-primary"><Tag className="w-4 h-4"/> ملاحظات الإدارة</h3>
                      <div className="bg-orange-50 text-orange-800 p-4 rounded-lg text-sm border border-orange-200">
                        {viewingSupplier.notes}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                   <h3 className="font-semibold text-lg flex items-center gap-2 mb-3 border-b pb-2"><Phone className="w-5 h-5"/> جهات الاتصال</h3>
                   
                   <div className="space-y-4 pl-4 border-r-2 border-primary/20">
                     <div className="flex gap-3">
                       <Phone className="w-5 h-5 text-muted-foreground shrink-0" />
                       <div>
                         <p className="text-sm text-muted-foreground">الهاتف المحمول</p>
                         <p className="font-medium" dir="ltr">{viewingSupplier.phone || 'غير مسجل'}</p>
                       </div>
                     </div>
                     <div className="flex gap-3">
                       <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                       <div>
                         <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                         <p className="font-medium" dir="ltr">{viewingSupplier.email || 'غير مسجل'}</p>
                       </div>
                     </div>
                     <div className="flex gap-3">
                       <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                       <div>
                         <p className="text-sm text-muted-foreground">مقر الشركة / العنوان</p>
                         <p className="font-medium">{viewingSupplier.address || 'غير مسجل'}</p>
                       </div>
                     </div>
                     <div className="flex gap-3">
                       <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                       <div>
                         <p className="text-sm text-muted-foreground">الرقم الضريبي</p>
                         <p className="font-medium tracking-widest">{viewingSupplier.taxId || 'غير مسجل'}</p>
                       </div>
                     </div>
                   </div>
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 border-t flex justify-end gap-3">
                 <Button variant="outline" className="px-6" onClick={() => setViewingSupplier(null)}>إغلاق الملف</Button>
                 <Button className="px-6 gap-2" onClick={() => { setViewingSupplier(null); openEditDialog(viewingSupplier); }}>
                    <Edit className="w-4 h-4" /> تعديل البيانات
                 </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}
