import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useTenantBranch } from '@/hooks/useDatabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, Terminal, Code2, Copy, Check, ShieldAlert, Sparkles, Layers, RefreshCw, KeyRound, AlertTriangle, Clock, ArrowRight, BookOpen
} from 'lucide-react';

const generateUuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface IntegrationOption {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'disabled' | 'revoked';
  allowed_branch_ids: string[];
  permissions: string[];
  rate_limit_tier: string;
}

interface EndpointDefinition {
  id: string;
  group: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  permission: string | null;
  defaultBody?: any;
  pathParams?: string[];
  isDestructive?: boolean;
}

const PLAYGROUND_ENDPOINTS: EndpointDefinition[] = [
  { id: 'health', group: 'System', method: 'GET', path: '/health', title: 'System Health Check', description: 'Inspect API gateway and distributed worker status', permission: null },
  { id: 'settings', group: 'Settings', method: 'GET', path: '/settings', title: 'Restaurant Settings', description: 'Fetch branding, currency, tax rates, and locale', permission: 'settings:read' },
  { id: 'branches', group: 'Branches', method: 'GET', path: '/branches', title: 'List Active Branches', description: 'Retrieve branches authorized for this tenant', permission: 'branches:read' },
  { id: 'menu', group: 'Catalog', method: 'GET', path: '/menu', title: 'Full Menu Catalog', description: 'Fetch categories with nested products and addons', permission: 'menu:read' },
  { id: 'categories', group: 'Catalog', method: 'GET', path: '/categories', title: 'List Categories', description: 'Fetch all active menu categories', permission: 'menu:read' },
  { id: 'products', group: 'Catalog', method: 'GET', path: '/products', title: 'List Products', description: 'Fetch products with optional category filtering', permission: 'menu:read' },
  { id: 'delivery_zones', group: 'Delivery', method: 'GET', path: '/delivery-zones', title: 'Delivery Zones', description: 'Inspect branch delivery coverage and fees', permission: 'delivery:read' },
  { id: 'offers', group: 'Promotions', method: 'GET', path: '/offers', title: 'Active Offers & Discounts', description: 'Retrieve active coupons and promotions', permission: 'offers:read' },
  { 
    id: 'pricing_preview', 
    group: 'Pricing', 
    method: 'POST', 
    path: '/pricing/preview', 
    title: 'Authoritative Pricing Preview', 
    description: 'Server-side price calculation with subtotal, tax, and fees', 
    permission: 'menu:read',
    defaultBody: {
      branch_id: 'branch_1',
      order_type: 'delivery',
      items: [{ product_id: 'prod_1', quantity: 2 }],
      coupon_code: 'WELCOME10'
    }
  },
  { 
    id: 'create_order', 
    group: 'Orders', 
    method: 'POST', 
    path: '/orders', 
    title: 'Create Customer Order', 
    description: 'Submit order with idempotent pricing snapshot', 
    permission: 'orders:create',
    isDestructive: true,
    defaultBody: {
      branch_id: 'branch_1',
      order_type: 'takeaway',
      items: [{ product_id: 'prod_1', quantity: 1 }],
      customer: { name: 'Demo Customer', phone: '+1234567890' },
      payment_method: 'cash'
    }
  },
  { id: 'track_order', group: 'Orders', method: 'GET', path: '/orders/{id}/track', title: 'Live Order Tracking', description: 'Customer-safe tracking with state history', permission: 'orders:read', pathParams: ['id'] },
  { 
    id: 'update_order_status', 
    group: 'Orders', 
    method: 'PATCH', 
    path: '/orders/{id}/status', 
    title: 'Update Order Status', 
    description: 'Advance order state (e.g. preparing, ready, delivered)', 
    permission: 'orders:update_status',
    isDestructive: true,
    pathParams: ['id'],
    defaultBody: { status: 'preparing', notes: 'Kitchen started preparation' }
  },
];

export default function DeveloperPlayground() {
  const { tenantId } = useTenantBranch();
  const { toast } = useToast();

  const [apiVersion, setApiVersion] = useState<'v1' | 'v2'>('v1');
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDefinition>(PLAYGROUND_ENDPOINTS[0]);
  
  // Request parameters
  const [pathParamValues, setPathParamValues] = useState<Record<string, string>>({ id: 'ord_demo123' });
  const [branchHeader, setBranchHeader] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [requestBodyText, setRequestBodyText] = useState('');
  const [isDestructiveModalOpen, setIsDestructiveModalOpen] = useState(false);
  
  // Execution state
  const [loading, setLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Initialize demo/mock integrations for tenant
  useEffect(() => {
    const mockList: IntegrationOption[] = [
      {
        id: 'int_website_live',
        name: 'Online Ordering Website',
        type: 'custom_website',
        status: 'active',
        allowed_branch_ids: [],
        permissions: ['menu:read', 'orders:create', 'orders:read', 'branches:read', 'delivery:read', 'offers:read', 'settings:read'],
        rate_limit_tier: 'standard',
      },
      {
        id: 'int_kiosk_pos',
        name: 'Dine-In Kiosk #1',
        type: 'kiosk',
        status: 'active',
        allowed_branch_ids: ['branch_1'],
        permissions: ['menu:read', 'orders:create', 'branches:read'],
        rate_limit_tier: 'free',
      },
    ];
    setIntegrations(mockList);
    setSelectedIntegrationId(mockList[0].id);
  }, [tenantId]);

  // Update request body when selecting endpoint
  useEffect(() => {
    if (selectedEndpoint.defaultBody) {
      setRequestBodyText(JSON.stringify(selectedEndpoint.defaultBody, null, 2));
    } else {
      setRequestBodyText('');
    }
    if (selectedEndpoint.id === 'create_order') {
      setIdempotencyKey(`play_${generateUuid().slice(0, 16)}`);
    } else {
      setIdempotencyKey('');
    }
  }, [selectedEndpoint]);

  const selectedIntegration = integrations.find((i) => i.id === selectedIntegrationId);
  const hasPermission = !selectedEndpoint.permission || (selectedIntegration?.permissions.includes(selectedEndpoint.permission) ?? false);

  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    toast({ title: 'تم النسخ بنجاح' });
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleExecute = async () => {
    if (selectedEndpoint.isDestructive && !isDestructiveModalOpen) {
      setIsDestructiveModalOpen(true);
      return;
    }
    setIsDestructiveModalOpen(false);
    setLoading(true);

    let resolvedPath = selectedEndpoint.path;
    if (selectedEndpoint.pathParams) {
      for (const p of selectedEndpoint.pathParams) {
        resolvedPath = resolvedPath.replace(`{${p}}`, pathParamValues[p] || 'demo');
      }
    }

    let parsedBody: any = undefined;
    if (requestBodyText && ['POST', 'PATCH', 'PUT'].includes(selectedEndpoint.method)) {
      try {
        parsedBody = JSON.parse(requestBodyText);
      } catch (err: any) {
        toast({ title: 'خطأ في صياغة JSON', description: err.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': `req_play_${generateUuid().slice(0, 12)}`,
    };
    if (branchHeader) headers['X-Branch-ID'] = branchHeader;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const fullUrl = `https://api.example-restaurant.com/api/${apiVersion}${resolvedPath}`;

    // Simulate safe execution
    setTimeout(() => {
      setLoading(false);
      const isSuccess = hasPermission;
      const statusCode = isSuccess ? (selectedEndpoint.method === 'POST' ? 201 : 200) : 403;
      
      let mockBody: any = {
        success: isSuccess,
        data: isSuccess
          ? {
              status: 'healthy',
              message: `Executed ${selectedEndpoint.method} /api/${apiVersion}${resolvedPath} successfully on tenant: ${tenantId || 'tenant_main'}`,
              payload: parsedBody || { items_count: 1 },
              timestamp: new Date().toISOString(),
            }
          : {
              error: {
                code: 'FORBIDDEN',
                message: `Permission denied: Missing required permission '${selectedEndpoint.permission}'`,
              },
            },
      };

      setExecutionResult({
        status_code: statusCode,
        duration_ms: Math.floor(Math.random() * 40) + 15,
        request_id: headers['X-Request-ID'],
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-request-id': headers['X-Request-ID'],
          'x-ratelimit-limit': '500',
          'x-ratelimit-remaining': '498',
          'x-ratelimit-reset': '52',
        },
        body: mockBody,
        code_examples: {
          curl: `curl -X ${selectedEndpoint.method} \\\n  '${fullUrl}' \\\n  -H 'Authorization: Bearer <YOUR_API_KEY>' \\\n  -H 'X-Request-ID: ${headers['X-Request-ID']}'${branchHeader ? ` \\\n  -H 'X-Branch-ID: ${branchHeader}'` : ''}${idempotencyKey ? ` \\\n  -H 'Idempotency-Key: ${idempotencyKey}'` : ''}${parsedBody ? ` \\\n  -d '${JSON.stringify(parsedBody, null, 2)}'` : ''}`,
          javascript: `const response = await fetch('${fullUrl}', {\n  method: '${selectedEndpoint.method}',\n  headers: {\n    'Authorization': 'Bearer ' + process.env.RMS_API_KEY,\n    'X-Request-ID': '${headers['X-Request-ID']}'\n  }${parsedBody ? `,\n  body: JSON.stringify(${JSON.stringify(parsedBody, null, 4)})` : ''}\n});\nconst data = await response.json();`,
          sdk: `import { RmsApiClient } from '@rms/sdk';\n\nconst rms = new RmsApiClient({\n  baseUrl: 'https://api.example-restaurant.com/api/${apiVersion}',\n  apiKey: process.env.RMS_API_KEY!,\n});\n\n// Call official SDK method\nconst result = await rms.${selectedEndpoint.id === 'menu' ? 'getMenu()' : selectedEndpoint.id === 'create_order' ? 'createOrder(input, { idempotencyKey })' : 'getHealth()'};\nconsole.log(result);`,
        },
      });
      toast({ title: isSuccess ? 'تم تنفيذ الطلب بنجاح' : 'تم رفض الطلب: نقص الصلاحية' });
    }, 400);
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'POST': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'PATCH': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'DELETE': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-7 h-7 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Interactive Developer Playground</h1>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">Universal SaaS</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              بيئة تفاعلية لاختبار واجهات الـ REST API واستعراض نماذج الـ SDK دون تسريب أي أسرار
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Version Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/40">
              <button
                onClick={() => setApiVersion('v1')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  apiVersion === 'v1' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                API v1 (Stable)
              </button>
              <button
                onClick={() => setApiVersion('v2')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  apiVersion === 'v2' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                API v2 (Next)
              </button>
            </div>

            {/* Integration Selector */}
            <div className="w-64">
              <Select value={selectedIntegrationId} onValueChange={setSelectedIntegrationId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر القناة / Integration" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map((int) => (
                    <SelectItem key={int.id} value={int.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{int.name}</span>
                        <Badge variant="secondary" className="text-[10px] uppercase">{int.type}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Explorer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Endpoints Browser (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-4 pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  نقاط الاتصال (Endpoints)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1 max-h-[680px] overflow-y-auto">
                {PLAYGROUND_ENDPOINTS.map((ep) => {
                  const isSelected = selectedEndpoint.id === ep.id;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => {
                        setSelectedEndpoint(ep);
                        setExecutionResult(null);
                      }}
                      className={`w-full text-right p-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-primary/10 border-primary/40 text-primary shadow-xs'
                          : 'border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={`text-[10px] font-mono px-1.5 py-0 border ${getMethodBadgeColor(ep.method)}`}>
                          {ep.method}
                        </Badge>
                        <span className="truncate">{ep.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/60">{ep.path}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Integration Details Info Box */}
            {selectedIntegration && (
              <Card className="border-border/60 bg-muted/20">
                <CardContent className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <KeyRound className="w-3.5 h-3.5 text-primary" />
                      معرف القناة
                    </span>
                    <span className="font-mono text-[11px]">{selectedIntegration.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">نوع التكامل</span>
                    <Badge variant="outline" className="text-[10px]">{selectedIntegration.type}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">باقة الاستخدام</span>
                    <Badge variant="secondary" className="text-[10px] uppercase">{selectedIntegration.rate_limit_tier}</Badge>
                  </div>
                  <div className="pt-2 border-t border-border/40">
                    <span className="text-muted-foreground block mb-1.5">الصلاحيات المفعلة:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedIntegration.permissions.map((p) => (
                        <Badge key={p} variant="secondary" className="text-[9px] font-mono bg-background">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Request Builder & Response Inspector (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Request Builder Card */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="p-5 pb-4 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`font-mono text-xs border ${getMethodBadgeColor(selectedEndpoint.method)}`}>
                        {selectedEndpoint.method}
                      </Badge>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        /api/{apiVersion}{selectedEndpoint.path}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedEndpoint.description}</p>
                  </div>

                  <Button
                    onClick={handleExecute}
                    disabled={loading || !hasPermission}
                    className="gap-2 h-9 px-4 shrink-0"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    تنفيذ الطلب
                  </Button>
                </div>

                {!hasPermission && (
                  <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      القناة المحددة لا تملك الصلاحية المطلوبة (<code className="font-mono">{selectedEndpoint.permission}</code>). لن يتم تنفيذ الطلب بنجاح.
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* Path Params */}
                {selectedEndpoint.pathParams && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">المعاملات (Path Parameters)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedEndpoint.pathParams.map((param) => (
                        <div key={param} className="space-y-1">
                          <span className="text-[11px] text-muted-foreground font-mono">:{param}</span>
                          <Input
                            size={1}
                            value={pathParamValues[param] || ''}
                            onChange={(e) => setPathParamValues({ ...pathParamValues, [param]: e.target.value })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Headers Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground font-mono">X-Branch-ID (اختياري)</Label>
                    <Input
                      value={branchHeader}
                      onChange={(e) => setBranchHeader(e.target.value)}
                      placeholder="branch_1"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  {selectedEndpoint.id === 'create_order' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground font-mono">Idempotency-Key</Label>
                        <button
                          onClick={() => setIdempotencyKey(`play_${uuidv4().slice(0, 16)}`)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          توليد جديد
                        </button>
                      </div>
                      <Input
                        value={idempotencyKey}
                        onChange={(e) => setIdempotencyKey(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Request Body Editor */}
                {['POST', 'PATCH', 'PUT'].includes(selectedEndpoint.method) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">محتوى الطلب (JSON Request Body)</Label>
                    <textarea
                      value={requestBodyText}
                      onChange={(e) => setRequestBodyText(e.target.value)}
                      rows={7}
                      className="w-full font-mono text-xs bg-muted/30 border border-border/60 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Response Inspector & Code Generation */}
            {executionResult && (
              <Card className="border-border/60 shadow-sm animate-in fade-in-50 duration-200">
                <CardHeader className="p-4 border-b border-border/40 bg-muted/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Badge
                        className={`font-mono text-xs ${
                          executionResult.status_code < 400
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}
                      >
                        {executionResult.status_code} {executionResult.status_code === 200 ? 'OK' : executionResult.status_code === 201 ? 'Created' : 'Error'}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        {executionResult.duration_ms} ms
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ID: {executionResult.request_id}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <Tabs defaultValue="response" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-transparent px-4 h-10">
                      <TabsTrigger value="response" className="text-xs">الاستجابة (Response)</TabsTrigger>
                      <TabsTrigger value="headers" className="text-xs">الترويسات (Headers)</TabsTrigger>
                      <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                      <TabsTrigger value="sdk" className="text-xs font-semibold text-primary">@rms/sdk</TabsTrigger>
                      <TabsTrigger value="javascript" className="text-xs">JavaScript</TabsTrigger>
                    </TabsList>

                    {/* Response Body Tab */}
                    <TabsContent value="response" className="p-4 m-0 relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(JSON.stringify(executionResult.body, null, 2), 'response')}
                        className="absolute top-6 left-6 h-7 text-xs gap-1"
                      >
                        {copiedTab === 'response' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        نسخ
                      </Button>
                      <pre className="font-mono text-xs bg-muted/40 p-4 rounded-lg overflow-x-auto max-h-96 text-foreground">
                        {JSON.stringify(executionResult.body, null, 2)}
                      </pre>
                    </TabsContent>

                    {/* Response Headers Tab */}
                    <TabsContent value="headers" className="p-4 m-0">
                      <div className="space-y-1 font-mono text-xs bg-muted/30 p-3 rounded-lg">
                        {Object.entries(executionResult.headers).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                            <span className="text-muted-foreground">{k}:</span>
                            <span className="text-foreground">{v as string}</span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* cURL Example Tab */}
                    <TabsContent value="curl" className="p-4 m-0 relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(executionResult.code_examples.curl, 'curl')}
                        className="absolute top-6 left-6 h-7 text-xs gap-1"
                      >
                        {copiedTab === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        نسخ
                      </Button>
                      <pre className="font-mono text-xs bg-muted/40 p-4 rounded-lg overflow-x-auto text-foreground">
                        {executionResult.code_examples.curl}
                      </pre>
                    </TabsContent>

                    {/* SDK Example Tab */}
                    <TabsContent value="sdk" className="p-4 m-0 relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(executionResult.code_examples.sdk, 'sdk')}
                        className="absolute top-6 left-6 h-7 text-xs gap-1"
                      >
                        {copiedTab === 'sdk' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        نسخ
                      </Button>
                      <pre className="font-mono text-xs bg-muted/40 p-4 rounded-lg overflow-x-auto text-primary">
                        {executionResult.code_examples.sdk}
                      </pre>
                    </TabsContent>

                    {/* JavaScript Fetch Tab */}
                    <TabsContent value="javascript" className="p-4 m-0 relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(executionResult.code_examples.javascript, 'javascript')}
                        className="absolute top-6 left-6 h-7 text-xs gap-1"
                      >
                        {copiedTab === 'javascript' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        نسخ
                      </Button>
                      <pre className="font-mono text-xs bg-muted/40 p-4 rounded-lg overflow-x-auto text-foreground">
                        {executionResult.code_examples.javascript}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Destructive Action Confirmation Dialog */}
        <Dialog open={isDestructiveModalOpen} onOpenChange={setIsDestructiveModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                تأكيد عملية إنشاء أو تعديل بيانات
              </DialogTitle>
              <DialogDescription className="pt-2">
                هذا الطلب سيقوم بإنشاء طلب حقيقي أو تعديل بيانات داخل النظام (<code className="font-mono text-xs">{selectedEndpoint.method} {selectedEndpoint.path}</code>). هل ترغب في المتابعة؟
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDestructiveModalOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleExecute} className="bg-warning text-warning-foreground hover:bg-warning/90">
                تأكيد وتنفيذ الطلب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
