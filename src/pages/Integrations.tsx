import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';
import {
  Plus, Search, CheckCircle, XCircle, Settings, RefreshCw, Key, Shield, Copy, AlertTriangle, Trash2, Power, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useIntegrations, useTenantBranch } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_INTEGRATIONS = [
  { id: 'stripe', name: 'Stripe', category: 'payment', description: 'بوابة دفع إلكتروني', iconName: 'CreditCard', status: 'disconnected', color: 'bg-purple-500' },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'messaging', description: 'إشعارات وتواصل العملاء', iconName: 'MessageSquare', status: 'disconnected', color: 'bg-green-500' },
  { id: 'talabat', name: 'طلبات', category: 'aggregator', description: 'منصة توصيل الطعام', iconName: 'Truck', status: 'disconnected', color: 'bg-orange-500' },
  { id: 'analytics', name: 'Google Analytics', category: 'analytics', description: 'تحليلات الموقع', iconName: 'BarChart3', status: 'disconnected', color: 'bg-blue-500' },
  { id: 'epson', name: 'طابعات Epson', category: 'hardware', description: 'طابعات الإيصالات', iconName: 'Printer', status: 'disconnected', color: 'bg-gray-600' },
  { id: 'paymob', name: 'Paymob', category: 'payment', description: 'بوابة دفع محلية', iconName: 'CreditCard', status: 'disconnected', color: 'bg-blue-600' },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  connected: { label: 'متصل', color: 'bg-success/10 text-success', icon: CheckCircle },
  pending: { label: 'قيد التفعيل', color: 'bg-warning/10 text-warning', icon: RefreshCw },
  disconnected: { label: 'غير متصل', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

interface ApiClientItem {
  id: string;
  name: string;
  description?: string;
  client_id: string;
  secret_last4: string;
  status: 'active' | 'disabled' | 'revoked';
  permissions: string[];
  allowed_branch_ids: string[];
  created_at: string;
  last_used_at: string | null;
}

export default function Integrations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hardwareDevices, setHardwareDevices] = useState<{name: string, type: string, status: string}[]>([]);
  const { tenantId } = useTenantBranch();
  const { integrations: dbIntegrations, updateIntegration, addIntegration } = useIntegrations(tenantId);
  const { toast } = useToast();

  // API Clients State
  const [apiClients, setApiClients] = useState<ApiClientItem[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDesc, setNewClientDesc] = useState('');
  const [generatedSecretData, setGeneratedSecretData] = useState<{ clientId: string; secret: string } | null>(null);

  const getConnectedHardware = async () => {
    if ('usb' in navigator) {
      try {
        const devices = await (navigator as any).usb.getDevices();
        const mapped = devices.map((d: any) => ({
          name: d.productName || 'طابعة إيصالات',
          type: 'طابعة إيصالات ودرج كاشير',
          status: 'connected'
        }));
        setHardwareDevices(mapped);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    getConnectedHardware();
    // Initialize mock/current api clients for the tenant
    setApiClients([
      {
        id: 'cli_sushi_web',
        client_id: 'cli_sushi_web',
        name: 'موقع وتطبيق سوشي بار الخارجي',
        description: 'تطبيق الطلبات الإلكترونية للعملاء',
        secret_last4: '9f8a',
        status: 'active',
        permissions: ['menu:read', 'orders:create', 'orders:read', 'webhooks:manage'],
        allowed_branch_ids: [],
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      },
    ]);
  }, []);

  const scanForHardware = async () => {
    try {
      if (!('usb' in navigator)) {
        toast({ title: 'غير مدعوم', description: 'متصفحك لا يدعم اكتشاف أجهزة USB المباشر', variant: 'destructive' });
        return;
      }
      
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      
      if (device) {
        const deviceName = device.productName || 'طابعة غير معروفة';
        const newDevice = {
          name: deviceName,
          type: 'طابعة إيصالات ودرج كاشير',
          status: 'connected'
        };
        
        setHardwareDevices(prev => {
          if (!prev.find(d => d.name === newDevice.name)) {
             toast({ title: 'نجاح', description: `تم اكتشاف ${deviceName} بنجاح` });
             return [...prev, newDevice];
          }
          return prev;
        });
      }
    } catch (e: any) {
      console.log('User cancelled device selection', e);
    }
  };

  const toggleIntegration = async (integration: any, connect: boolean) => {
    const newStatus = connect ? 'connected' : 'disconnected';
    if (integration.dbId) {
      await updateIntegration(integration.dbId, { status: newStatus });
    } else {
      await addIntegration({ integration_id: integration.id, status: newStatus, name: integration.name });
    }
  };

  const handleCreateClient = () => {
    if (!newClientName) return;
    const generatedId = `cli_${Math.random().toString(36).substring(2, 14)}`;
    const generatedSecret = `rms_sec_${Math.random().toString(36).substring(2, 24)}${Math.random().toString(36).substring(2, 24)}`;
    
    const newClient: ApiClientItem = {
      id: generatedId,
      client_id: generatedId,
      name: newClientName,
      description: newClientDesc,
      secret_last4: generatedSecret.slice(-4),
      status: 'active',
      permissions: ['menu:read', 'orders:create', 'orders:read'],
      allowed_branch_ids: [],
      created_at: new Date().toISOString(),
      last_used_at: null,
    };

    setApiClients(prev => [newClient, ...prev]);
    setGeneratedSecretData({ clientId: generatedId, secret: generatedSecret });
    setIsCreateModalOpen(false);
    setNewClientName('');
    setNewClientDesc('');
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: message });
  };

  const integrations = DEFAULT_INTEGRATIONS.map(def => {
    const dbInt = dbIntegrations.find(i => i.integration_id === def.id);
    return {
      ...def,
      dbId: dbInt?.id,
      status: dbInt ? dbInt.status : def.status,
      icon: (Icons as any)[def.iconName] || Icons.Puzzle
    };
  });

  const filteredIntegrations = integrations.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.includes(searchQuery));
  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <MainLayout title="مركز التكاملات ومفاتيح الربط" subtitle="إدارة المنصات الخارجية ومفاتيح الـ REST API"
      actions={
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 text-xs md:text-sm">
          <Key className="w-4 h-4" />
          <span>إنشاء مفتاح API جديد</span>
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-primary">{integrations.length}</p><p className="text-xs md:text-sm text-muted-foreground">إجمالي التكاملات</p></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-success">{connectedCount}</p><p className="text-xs md:text-sm text-muted-foreground">متصل</p></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-warning">{apiClients.length}</p><p className="text-xs md:text-sm text-muted-foreground">مفاتيح API مسجلة</p></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-info">3</p><p className="text-xs md:text-sm text-muted-foreground">Webhooks نشطة</p></CardContent></Card>
      </div>

      <Tabs defaultValue="apikeys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="apikeys" className="gap-2"><Key className="w-4 h-4" />مفاتيح الـ REST API</TabsTrigger>
          <TabsTrigger value="software">البرامج والمنصات</TabsTrigger>
          <TabsTrigger value="hardware">أجهزة الكاشير (طابعات - درج)</TabsTrigger>
        </TabsList>

        {/* Tab 1: API Clients & Keys Management */}
        <TabsContent value="apikeys" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-xl border">
            <div>
              <h3 className="font-bold text-base md:text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                مفاتيح ربط التطبيقات الخارجية (REST API Clients)
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                تتيح لمواقع المطاعم وتطبيقات التوصيل الوصول الآمن إلى المنيو وإنشاء الطلبات وتتبعها عبر بروتوكول HTTPS المشفر.
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 text-xs md:text-sm">
              <Plus className="w-4 h-4" />
              <span>مفتاح جديد</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {apiClients.map((client) => (
              <Card key={client.id} className="border hover:shadow-sm transition-shadow">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-base md:text-lg">{client.name}</h4>
                        <Badge variant={client.status === 'active' ? 'default' : client.status === 'disabled' ? 'secondary' : 'destructive'} className="text-xs">
                          {client.status === 'active' ? 'نشط' : client.status === 'disabled' ? 'معطل' : 'ملغي'}
                        </Badge>
                      </div>
                      {client.description && (
                        <p className="text-xs text-muted-foreground">{client.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-muted-foreground">
                        <span className="bg-muted px-2 py-1 rounded">Client ID: {client.client_id}</span>
                        <span className="bg-muted px-2 py-1 rounded">Secret: ••••••••••••••••{client.secret_last4}</span>
                        <span>أنشئ: {new Date(client.created_at).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => copyToClipboard(client.client_id, 'تم نسخ Client ID إلى الحافظة')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        نسخ المعرف
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => {
                          const newSec = `rms_sec_${Math.random().toString(36).substring(2, 24)}`;
                          setGeneratedSecretData({ clientId: client.client_id, secret: newSec });
                          setApiClients(prev => prev.map(c => c.id === client.id ? { ...c, secret_last4: newSec.slice(-4) } : c));
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        تدوير المفتاح
                      </Button>
                      <Button
                        variant={client.status === 'active' ? 'secondary' : 'default'}
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => {
                          const nextStatus = client.status === 'active' ? 'disabled' : 'active';
                          setApiClients(prev => prev.map(c => c.id === client.id ? { ...c, status: nextStatus } : c));
                          toast({ title: 'تم التحديث', description: `تم تحويل حالة المفتاح إلى ${nextStatus === 'active' ? 'نشط' : 'معطل'}` });
                        }}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {client.status === 'active' ? 'تعطيل' : 'تفعيل'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Software Integrations */}
        <TabsContent value="software" className="space-y-4">
          <div className="relative w-full md:w-80 mb-6"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="بحث عن تكامل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" /></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIntegrations.map((integration) => {
              const status = statusConfig[integration.status];
              const StatusIcon = status.icon;
              const IntegrationIcon = integration.icon;
              return (
                <Card key={integration.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0', integration.color)}><IntegrationIcon className="w-5 h-5 md:w-6 md:h-6" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1"><h4 className="font-bold text-sm md:text-base">{integration.name}</h4><Badge className={cn('text-[10px] md:text-xs', status.color)}><StatusIcon className="w-3 h-3 ml-1" />{status.label}</Badge></div>
                        <p className="text-xs text-muted-foreground mb-3">{integration.description}</p>
                        <div className="flex items-center gap-2">
                          {integration.status === 'connected' ? <><Button variant="outline" size="sm" className="gap-1 text-xs"><Settings className="w-4 h-4" />إعدادات</Button><Switch checked={true} onCheckedChange={(v) => toggleIntegration(integration, v)} /></> : <Button onClick={() => toggleIntegration(integration, true)} size="sm" className="gap-1 text-xs"><Plus className="w-4 h-4" />ربط</Button>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        {/* Tab 3: Hardware Devices */}
        <TabsContent value="hardware" className="space-y-4">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
             <div>
               <h3 className="text-lg font-bold">الأجهزة المتصلة بالنظام</h3>
               <p className="text-sm text-muted-foreground">قم بإدارة طابعات الإيصالات وأدراج الكاشير المتصلة بجهازك محلياً</p>
             </div>
             <Button onClick={scanForHardware} className="gap-2"><RefreshCw className="w-4 h-4" /> اكتشاف أجهزة USB</Button>
           </div>
           
           {hardwareDevices.length === 0 ? (
             <Card className="p-8 text-center text-muted-foreground border-dashed">
                <Icons.Printer className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد أجهزة متصلة حالياً</p>
                <p className="text-sm mt-1">انقر على الزر أعلاه لاكتشاف الطابعات وأدراج الكاشير</p>
             </Card>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {hardwareDevices.map((dev, idx) => (
                 <Card key={idx} className="border-success/20 bg-success/5">
                   <CardContent className="p-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center">
                         <Icons.Printer className="w-6 h-6" />
                       </div>
                       <div>
                         <h4 className="font-bold">{dev.name}</h4>
                         <p className="text-sm text-muted-foreground">{dev.type}</p>
                       </div>
                     </div>
                     <Badge className="bg-success text-success-foreground border-transparent">متصل ونشط</Badge>
                   </CardContent>
                 </Card>
               ))}
               
               <Card className="border-dashed flex items-center justify-center min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={scanForHardware}>
                 <div className="text-center text-muted-foreground">
                   <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                   <p className="text-sm font-medium">إضافة جهاز آخر</p>
                 </div>
               </Card>
             </div>
           )}
        </TabsContent>
      </Tabs>

      {/* Modal 1: Create API Client Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              إنشاء مفتاح API جديد
            </DialogTitle>
            <DialogDescription>
              قم بإنشاء بيانات اعتماد لتطبيق أو موقع خارجي للاتصال بالنظام عبر REST API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="client-name">اسم التطبيق / العميل</Label>
              <Input
                id="client-name"
                placeholder="مثال: تطبيق سوشي بار للآيفون"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-desc">الوصف (اختياري)</Label>
              <Input
                id="client-desc"
                placeholder="مثال: مخصص لطلبات التوصيل للموقع الخارجي"
                value={newClientDesc}
                onChange={(e) => setNewClientDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateClient} disabled={!newClientName}>إنشاء المفتاح</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: One-Time Secret Reveal Modal */}
      <Dialog open={!!generatedSecretData} onOpenChange={(open) => !open && setGeneratedSecretData(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              احفظ المفتاح السري الآن!
            </DialogTitle>
            <DialogDescription>
              لن تتمكن من رؤية هذا المفتاح السري مرة أخرى بعد إغلاق هذه النافذة لأسباب أمنية مشددة.
            </DialogDescription>
          </DialogHeader>
          {generatedSecretData && (
            <div className="space-y-4 py-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client ID (معرف العميل)</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={generatedSecretData.clientId} className="font-mono text-sm bg-muted" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedSecretData.clientId, 'تم نسخ Client ID')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client Secret (المفتاح السري المشفر)</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={generatedSecretData.secret} className="font-mono text-sm bg-muted text-primary font-bold" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedSecretData.secret, 'تم نسخ المفتاح السري')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning leading-relaxed">
                تنبيه: قم بنسخ المفتاح السري وحفظه في ملف البيئة (ENV) الخاص بتطبيقك الخارجي. يتم تخزين بصمة تشفيرية فقط في قاعدة البيانات.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setGeneratedSecretData(null)}>تم حفظ المفتاح بأمان</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
