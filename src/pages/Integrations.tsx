import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';
import {
  Plus, Search, CheckCircle, XCircle, Settings, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useIntegrations, useTenantBranch } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

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

export default function Integrations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hardwareDevices, setHardwareDevices] = useState<{name: string, type: string, status: string}[]>([]);
  const { tenantId } = useTenantBranch();
  const { integrations: dbIntegrations, updateIntegration, addIntegration, loading } = useIntegrations(tenantId);
  const { toast } = useToast();

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

  const toggleIntegration = async (integration: any, connect: boolean) => {
    const newStatus = connect ? 'connected' : 'disconnected';
    if (integration.dbId) {
      await updateIntegration(integration.dbId, { status: newStatus });
    } else {
      await addIntegration({ integration_id: integration.id, status: newStatus, name: integration.name });
    }
  };

  return (
    <MainLayout title="مركز التكاملات" subtitle="إدارة التكاملات الخارجية"
      actions={<Button className="gap-2 text-xs md:text-sm"><Plus className="w-4 h-4" /><span className="hidden sm:inline">إضافة تكامل</span></Button>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-primary">{integrations.length}</p><p className="text-xs md:text-sm text-muted-foreground">إجمالي التكاملات</p></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-success">{connectedCount}</p><p className="text-xs md:text-sm text-muted-foreground">متصل</p></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold text-warning">{integrations.filter(i => i.status === 'pending').length}</p><p className="text-xs md:text-sm text-muted-foreground">قيد التفعيل</p></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4 text-center"><p className="text-2xl md:text-3xl font-bold">3</p><p className="text-xs md:text-sm text-muted-foreground">Webhooks نشطة</p></CardContent></Card>
      </div>

      <Tabs defaultValue="software" className="space-y-6">
        <TabsList>
          <TabsTrigger value="software">البرامج والمنصات</TabsTrigger>
          <TabsTrigger value="hardware">أجهزة الكاشير (طابعات - درج)</TabsTrigger>
        </TabsList>

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
    </MainLayout>
  );
}
