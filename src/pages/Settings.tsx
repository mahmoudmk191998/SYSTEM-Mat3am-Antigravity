import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { useAppStore } from '@/lib/store';
import { useSettings, useUnits } from '@/hooks/useDatabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import {
  Languages,
  Save,
  Building2,
  Receipt,
  Bell,
  Shield,
  Palette,
  Database,
  Printer,
  CreditCard,
  Users,
  Clock,
  Globe,
  Mail,
  Phone,
  MapPin,
  Settings2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Scale,
  BookOpen
} from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, currentTenant, currentBranch, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { updateTenantSettings, wipeAllTenantData } = useSettings(currentTenant?.id || null);
  const { units, add: addUnit, update: updateUnit, remove: removeUnit, seedStandardUnits } = useUnits(currentTenant?.id || null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [newUnitMode, setNewUnitMode] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: '', abbreviation: '', type: 'count' });
  const [showDrawerPassword, setShowDrawerPassword] = useState(false);
  const [isResettingCounter, setIsResettingCounter] = useState(false);

  const handleSave = async () => {
    const success = await updateTenantSettings(settings);
    if (success) {
      toast.success('تم حفظ الإعدادات بنجاح');
    }
  };

  const handleWipeData = async () => {
    if (window.confirm('تحذير خطير: هل أنت متأكد من مسح جميع بيانات النظام؟ لا يمكن التراجع عن هذا الإجراء!')) {
      if (window.confirm('تأكيد نهائي: مسح جميع البيانات؟')) {
        setIsWiping(true);
        const success = await wipeAllTenantData(currentBranch?.id);
        if (success) {
          toast.success('تم مسح جميع البيانات من قاعدة البيانات. سيتم إعادة تحميل الصفحة.');
          setTimeout(() => window.location.reload(), 1500);
        }
        setIsWiping(false);
      }
    }
  };

  const handleResetOrderCounter = async () => {
    if (!currentBranch?.id) return;
    if (window.confirm('هل أنت متأكد من رغبتك في تصفير عداد أرقام الطلبات؟ هذا يعني أن الطلب القادم سيبدأ من رقم 1. يرجى توخي الحذر لتجنب تكرار أرقام الطلبات لنفس اليوم.')) {
      setIsResettingCounter(true);
      try {
        await deleteDoc(doc(db, 'branch_counters', currentBranch.id));
        toast.success('تم تصفير عداد الأرقام بنجاح! الطلب القادم سيبدأ من رقم 1.');
      } catch (error) {
        console.error(error);
        toast.error('حدثت مشكلة أثناء تصفير العداد.');
      } finally {
        setIsResettingCounter(false);
      }
    }
  };

  return (
    <MainLayout title="الإعدادات" subtitle="إعدادات النظام والتفضيلات">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-2 p-2">
          <TabsTrigger value="general" className="gap-2">
            <Settings2 className="w-4 h-4" />
            عام
          </TabsTrigger>
          <TabsTrigger value="branch" className="gap-2">
            <Building2 className="w-4 h-4" />
            الفرع
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-2">
            <Receipt className="w-4 h-4" />
            نقاط البيع
          </TabsTrigger>
          <TabsTrigger value="taxes" className="gap-2">
            <CreditCard className="w-4 h-4" />
            الضرائب والرسوم
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            الإشعارات
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            الأمان
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" />
            المظهر
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Database className="w-4 h-4" />
            التكاملات
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-2">
            <Scale className="w-4 h-4" />
            الوحدات
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="w-5 h-5" />
                  اللغة والتنسيق
                </CardTitle>
                <CardDescription>تخصيص طريقة عرض الأرقام والتاريخ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">الأرقام العربية الهندية</Label>
                    <p className="text-sm text-muted-foreground">استخدام ١٢٣ بدلاً من 123</p>
                  </div>
                  <Switch
                    checked={settings.useArabicNumerals}
                    onCheckedChange={(checked) => updateSettings({ useArabicNumerals: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">التقويم الهجري</Label>
                    <p className="text-sm text-muted-foreground">عرض التواريخ بالتقويم الهجري</p>
                  </div>
                  <Switch
                    checked={settings.useHijriCalendar}
                    onCheckedChange={(checked) => updateSettings({ useHijriCalendar: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>المنطقة الزمنية</Label>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span>Africa/Cairo (توقيت القاهرة)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  معلومات المؤسسة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم المؤسسة</Label>
                  <Input defaultValue={currentTenant?.name} />
                </div>
                <div className="space-y-2">
                  <Label>الاسم بالإنجليزية</Label>
                  <Input defaultValue="Golden Nile Restaurants" />
                </div>
                <div className="space-y-2">
                  <Label>الرقم الضريبي</Label>
                  <Input placeholder="أدخل الرقم الضريبي" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branch Settings */}
        <TabsContent value="branch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                إعدادات الفرع الحالي
              </CardTitle>
              <CardDescription>
                <Badge variant="outline" className="mt-2">{currentBranch?.name}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>اسم الفرع</Label>
                  <Input defaultValue={currentBranch?.name} />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input defaultValue={currentBranch?.phone} className="pr-10" />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>العنوان</Label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input defaultValue={currentBranch?.address} className="pr-10" />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    وقت الافتتاح
                  </Label>
                  <Input type="time" defaultValue="08:00" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    وقت الإغلاق
                  </Label>
                  <Input type="time" defaultValue="23:00" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POS Settings */}
        <TabsContent value="pos" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  إعدادات الإيصالات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>طباعة الإيصال تلقائياً</Label>
                    <p className="text-sm text-muted-foreground">طباعة فور إتمام الطلب</p>
                  </div>
                  <Switch 
                    checked={settings.autoPrintReceipt}
                    onCheckedChange={(checked) => updateSettings({ autoPrintReceipt: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>طباعة تذكرة المطبخ</Label>
                    <p className="text-sm text-muted-foreground">إرسال تذكرة للمطبخ</p>
                  </div>
                  <Switch 
                    checked={settings.printKitchenTicket}
                    onCheckedChange={(checked) => updateSettings({ printKitchenTicket: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>رسالة الترحيب</Label>
                  <Input 
                    value={settings.receiptWelcomeMessage}
                    onChange={(e) => updateSettings({ receiptWelcomeMessage: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="w-5 h-5" />
                  إعدادات الطابعات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">طابعة الإيصالات</span>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="w-3 h-3 text-success" />
                      متصلة
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">EPSON TM-T88V</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">طابعة المطبخ</span>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="w-3 h-3 text-success" />
                      متصلة
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">EPSON TM-T20III</p>
                </div>
                
                <Separator className="my-2" />
                <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20 mt-4">
                  <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> تصفير عداد الطلبات
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    سيتم مسح الرقم التسلسلي الحالي وإعادة الترقيم للطلبات الجديدة في الفرع لتبدأ من رقم 1.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={handleResetOrderCounter}
                    disabled={isResettingCounter}
                  >
                    {isResettingCounter ? 'جاري التصفير...' : 'إعادة الترقيم للبدء من 1'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                بيانات الفاتورة المطبوعة
              </CardTitle>
              <CardDescription>هذه البيانات ستظهر على الفاتورة المطبوعة للعميل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>اسم المؤسسة / المطعم</Label>
                  <Input 
                    value={settings.invoiceCompanyName || ''} 
                    onChange={(e) => updateSettings({ invoiceCompanyName: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input 
                    value={settings.invoicePhone || ''} 
                    onChange={(e) => updateSettings({ invoicePhone: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input 
                    value={settings.invoiceAddress || ''} 
                    onChange={(e) => updateSettings({ invoiceAddress: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>الرقم الضريبي</Label>
                  <Input 
                    value={settings.invoiceTaxNumber || ''} 
                    onChange={(e) => updateSettings({ invoiceTaxNumber: e.target.value })} 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>لوجو الفاتورة (أبيض وأسود يفضل للطابعات الحرارية)</Label>
                  <div className="flex items-center gap-4">
                    {settings.invoiceLogo && (
                      <div className="relative w-16 h-16 border rounded-lg overflow-hidden bg-white shrink-0">
                        <img src={settings.invoiceLogo} alt="Logo" className="w-full h-full object-contain" />
                        <button onClick={() => updateSettings({ invoiceLogo: '' })} className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1024 * 1024) {
                              toast.error('حجم الصورة كبير جداً. الحد الأقصى 1 ميجابايت');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              updateSettings({ invoiceLogo: reader.result as string });
                              toast.success('تم رفع اللوجو بنجاح');
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                إعدادات حماية الدرج
              </CardTitle>
              <CardDescription>التحكم في صلاحية الوصول لفتح درج الكاشير</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-[400px]">
                <Label>كلمة مرور فتح الدرج يدوياً</Label>
                <div className="flex gap-2 relative">
                  <Input 
                    type={showDrawerPassword ? 'text' : 'password'}
                    placeholder="اترك الحقل فارغاً لتعطيل الحماية"
                    value={settings.openDrawerPassword || ''}
                    onChange={(e) => updateSettings({ openDrawerPassword: e.target.value })}
                    className="pr-10 text-left w-full direction-ltr"
                    dir="ltr"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                    onClick={() => setShowDrawerPassword(!showDrawerPassword)}
                  >
                    {showDrawerPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">سيُطلب هذا الرمز السري عند محاولة فتح الدرج يدوياً من شاشة الكاشير</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Taxes Settings */}
        <TabsContent value="taxes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                الضرائب والرسوم
              </CardTitle>
              <CardDescription>إعدادات الضرائب ورسوم الخدمة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ضريبة القيمة المضافة (%)</Label>
                  <Input
                    type="number"
                    value={settings.taxRate}
                    onChange={(e) => updateSettings({ taxRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">النسبة الحالية في مصر: 14%</p>
                </div>
                <div className="space-y-2">
                  <Label>رسوم الخدمة (%)</Label>
                  <Input
                    type="number"
                    value={settings.serviceChargeRate}
                    onChange={(e) => updateSettings({ serviceChargeRate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">النسبة الشائعة: 12%</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>تضمين الضريبة في السعر</Label>
                  <p className="text-sm text-muted-foreground">الأسعار المعروضة شاملة الضريبة</p>
                </div>
                <Switch 
                  checked={settings.taxIncluded}
                  onCheckedChange={(checked) => updateSettings({ taxIncluded: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>تضمين الخدمة في السعر</Label>
                  <p className="text-sm text-muted-foreground">الأسعار المعروضة شاملة الخدمة</p>
                </div>
                <Switch 
                  checked={settings.serviceChargeIncluded}
                  onCheckedChange={(checked) => updateSettings({ serviceChargeIncluded: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                إعدادات الإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>تنبيهات الطلبات الجديدة</Label>
                  <p className="text-sm text-muted-foreground">إشعار عند وصول طلب جديد</p>
                </div>
                <Switch 
                  checked={settings.newOrderAlerts}
                  onCheckedChange={(checked) => updateSettings({ newOrderAlerts: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>تنبيهات انخفاض المخزون</Label>
                  <p className="text-sm text-muted-foreground">إشعار عند انخفاض صنف عن الحد الأدنى</p>
                </div>
                <Switch 
                  checked={settings.lowStockAlerts}
                  onCheckedChange={(checked) => updateSettings({ lowStockAlerts: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>تنبيهات الحجوزات</Label>
                  <p className="text-sm text-muted-foreground">إشعار قبل موعد الحجز</p>
                </div>
                <Switch 
                  checked={settings.reservationAlerts}
                  onCheckedChange={(checked) => updateSettings({ reservationAlerts: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>صوت الإشعارات</Label>
                  <p className="text-sm text-muted-foreground">تشغيل صوت عند الإشعارات</p>
                </div>
                <Switch 
                  checked={settings.notificationSound}
                  onCheckedChange={(checked) => updateSettings({ notificationSound: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  منطقة الخطر
                </CardTitle>
                <CardDescription>إجراءات لا يمكن التراجع عنها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <h4 className="font-semibold text-destructive mb-2">مسح جميع بيانات النظام</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    سيتم حذف جميع الطلبات، العملاء، الموظفين، الأصناف، الإعدادات وكل ما يتعلق بالنظام باستثناء بيانات الحساب الأساسية.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full gap-2"
                    onClick={handleWipeData}
                    disabled={isWiping}
                  >
                    <Trash2 className="w-4 h-4" />
                    {isWiping ? 'جاري المسح...' : 'مسح جميع البيانات'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    الأمان والصلاحيات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>تسجيل الخروج التلقائي</Label>
                      <p className="text-sm text-muted-foreground">بعد 30 دقيقة من عدم النشاط</p>
                    </div>
                    <Switch 
                      checked={settings.autoLogout}
                      onCheckedChange={(checked) => updateSettings({ autoLogout: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>طلب PIN للعمليات الحساسة</Label>
                      <p className="text-sm text-muted-foreground">مثل الخصومات والإلغاءات</p>
                    </div>
                    <Switch 
                      checked={settings.requirePin}
                      onCheckedChange={(checked) => updateSettings({ requirePin: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>تسجيل جميع العمليات</Label>
                      <p className="text-sm text-muted-foreground">حفظ سجل تدقيق شامل</p>
                    </div>
                    <Switch 
                      checked={settings.logAllOperations}
                      onCheckedChange={(checked) => updateSettings({ logAllOperations: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    إدارة الأدوار
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {['مدير عام', 'مدير فرع', 'كاشير', 'نادل', 'مطبخ', 'سائق'].map((role) => (
                    <div key={role} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span>{role}</span>
                      <Button variant="outline" size="sm">تعديل الصلاحيات</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                المظهر والألوان
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>الوضع الداكن</Label>
                  <p className="text-sm text-muted-foreground">تفعيل المظهر الداكن</p>
                </div>
                <Switch 
                  checked={settings.darkMode}
                  onCheckedChange={(checked) => updateSettings({ darkMode: checked })}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>اللون الرئيسي</Label>
                <div className="flex gap-2">
                  {['#1e3a5f', '#16a34a', '#dc2626', '#7c3aed', '#ea580c'].map((color) => (
                    <button
                      key={color}
                      className={`w-10 h-10 rounded-lg border-2 transition-colors ${settings.primaryColor === color ? 'border-primary' : 'border-transparent hover:border-primary/50'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => updateSettings({ primaryColor: color })}
                    />
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>طي الشريط الجانبي</Label>
                  <p className="text-sm text-muted-foreground">تصغير الشريط الجانبي افتراضياً</p>
                </div>
                <Switch 
                  checked={sidebarCollapsed}
                  onCheckedChange={setSidebarCollapsed}
                />
              </div>
            </CardContent>
          </Card>

          {/* Azkar Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                أذكار المسلم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>تفعيل الأذكار التلقائية</Label>
                  <p className="text-sm text-muted-foreground">عرض أذكار وتسبيحات بشكل دوري (إشعارات لطيفة)</p>
                </div>
                <Switch 
                  checked={settings.azkarEnabled}
                  onCheckedChange={(checked) => updateSettings({ azkarEnabled: checked })}
                />
              </div>
              {settings.azkarEnabled && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>تكرار الظهور (بالدقائق)</Label>
                    <div className="flex gap-2 w-full max-w-sm">
                      <div className="flex items-center gap-2 w-full">
                        <Input 
                          type="number"
                          min="1"
                          max="1440"
                          className="w-24 text-center"
                          value={settings.azkarInterval || 30}
                          onChange={(e) => updateSettings({ azkarInterval: Math.max(1, Number(e.target.value)) })}
                        />
                        <span className="text-sm text-muted-foreground">دقيقة</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Settings */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  قاعدة البيانات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-success/10 rounded-lg border border-success/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="font-medium text-success">متصل</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Lovable Cloud Database</p>
                </div>
                <div className="space-y-2">
                  <Label>معرف المشروع</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value="kvowbamkepgmdxiznegc"
                      readOnly
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>التكاملات الخارجية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Talabat', status: 'غير متصل' },
                  { name: 'Elmenus', status: 'غير متصل' },
                  { name: 'WhatsApp Business', status: 'غير متصل' },
                  { name: 'Paymob', status: 'غير متصل' },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span>{integration.name}</span>
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="w-3 h-3 text-warning" />
                      {integration.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Units Settings */}
        <TabsContent value="units" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  وحدات القياس
                </CardTitle>
                <CardDescription>إدارة وحدات القياس المستخدمة في النظام</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={async () => await seedStandardUnits()}>
                  استعادة الوحدات الافتراضية
                </Button>
                <Button onClick={() => setNewUnitMode(true)}>
                  إضافة وحدة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {newUnitMode && (
                <div className="p-4 bg-muted rounded-lg flex items-end gap-2 mb-4">
                  <div className="space-y-2 flex-1">
                    <Label>اسم الوحدة</Label>
                    <Input value={newUnit.name} onChange={e => setNewUnit({...newUnit, name: e.target.value})} placeholder="مثال: كيلوجرام" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>الاختصار</Label>
                    <Input value={newUnit.abbreviation} onChange={e => setNewUnit({...newUnit, abbreviation: e.target.value})} placeholder="مثال: كجم" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>النوع</Label>
                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                     value={newUnit.type} onChange={e => setNewUnit({...newUnit, type: e.target.value})}>
                      <option value="weight">وزن</option>
                      <option value="volume">حجم</option>
                      <option value="count">عدد/كمية</option>
                      <option value="length">طول</option>
                    </select>
                  </div>
                  <Button onClick={async () => {
                    if(!newUnit.name || !newUnit.abbreviation) return toast.error('يرجى تعبئة الحقول');
                    if(await addUnit(newUnit)) {
                      setNewUnitMode(false);
                      setNewUnit({ name: '', abbreviation: '', type: 'count' });
                    }
                  }}>
                    حفظ
                  </Button>
                  <Button variant="ghost" onClick={() => setNewUnitMode(false)}>
                    إلغاء
                  </Button>
                </div>
              )}
              
              <div className="rounded-md border">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 font-medium">اسم الوحدة</th>
                      <th className="p-3 font-medium">الاختصار</th>
                      <th className="p-3 font-medium">النوع</th>
                      <th className="p-3 font-medium w-[100px]">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit: any) => (
                      <tr key={unit.id} className="border-b last:border-0">
                        <td className="p-3">{unit.name}</td>
                        <td className="p-3">{unit.abbreviation}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {unit.type === 'weight' ? 'وزن' : unit.type === 'volume' ? 'حجم' : unit.type === 'length' ? 'طول' : 'عدد/كمية'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" className="text-destructive h-8 px-2 w-full" onClick={() => {
                            if(window.confirm('هل أنت متأكد من حذف هذه الوحدة؟')) removeUnit(unit.id);
                          }}>
                            حذف
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {units.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          لا توجد وحدات مضافة بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            حفظ جميع الإعدادات
          </Button>
        </div>
      </Tabs>
    </MainLayout>
  );
}
