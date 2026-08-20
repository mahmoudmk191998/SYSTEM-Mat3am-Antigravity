import { AzkarWidget } from "@/components/AzkarWidget";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useUserPermissions, routePermissions } from "@/hooks/usePermissions";
import { useTenantBranch } from "@/hooks/useDatabase";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import KitchenDisplay from "./pages/KitchenDisplay";
import OrdersHistory from "./pages/OrdersHistory";
import TablesReservations from "./pages/TablesReservations";
import MenuManagement from "./pages/MenuManagement";
import Inventory from "./pages/Inventory";
import Purchasing from "./pages/Purchasing";
import Production from "./pages/Production";
import Delivery from "./pages/Delivery";
import Customers from "./pages/Customers";
import Promotions from "./pages/Promotions";
import HR from "./pages/HR";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AuditLog from "./pages/AuditLog";
import Integrations from "./pages/Integrations";
import Permissions from "./pages/Permissions";
import Docs from "./pages/Docs";
import NotFound from "./pages/NotFound";
import Expenses from "./pages/Expenses";
import Suppliers from "./pages/Suppliers";
import WasteManagement from "./pages/WasteManagement";
import Shifts from "./pages/Shifts";
import Maintenance from "./pages/Maintenance";
import Accounting from "./pages/Accounting";
import CallCenter from "./pages/CallCenter";
import { Shield } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredPerms }: { children: React.ReactNode; requiredPerms?: string[] }) {
  const { user, loading: authLoading } = useAuth();
  const { hasAnyPermission, isAdmin, loading: permLoading, hasAnyRole } = useUserPermissions();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  // User has no role at all - show access denied
  if (!hasAnyRole && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground/30" />
          <h2 className="text-xl font-bold text-foreground">لا توجد صلاحيات</h2>
          <p className="text-muted-foreground">حسابك لا يملك أي صلاحيات بعد. يرجى التواصل مع المدير لمنحك الصلاحيات المطلوبة.</p>
        </div>
      </div>
    );
  }

  // Check specific permissions
  if (requiredPerms && !isAdmin && !hasAnyPermission(requiredPerms)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground/30" />
          <h2 className="text-xl font-bold text-foreground">غير مصرح بالدخول</h2>
          <p className="text-muted-foreground">ليس لديك صلاحية للوصول لهذه الصفحة.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { loading: tenantLoading } = useTenantBranch();

  if (authLoading || (user && tenantLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ProtectedRoute requiredPerms={['dashboard.view']}><Dashboard /></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute requiredPerms={['pos.view']}><POS /></ProtectedRoute>} />
      <Route path="/orders-history" element={<ProtectedRoute requiredPerms={['pos.view']}><OrdersHistory /></ProtectedRoute>} />
      <Route path="/kitchen" element={<ProtectedRoute requiredPerms={['kitchen.view']}><KitchenDisplay /></ProtectedRoute>} />
      <Route path="/tables" element={<ProtectedRoute requiredPerms={['tables.view']}><TablesReservations /></ProtectedRoute>} />
      <Route path="/menu" element={<ProtectedRoute requiredPerms={['menu.view']}><MenuManagement /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute requiredPerms={['inventory.view']}><Inventory /></ProtectedRoute>} />
      <Route path="/purchasing" element={<ProtectedRoute requiredPerms={['purchasing.view']}><Purchasing /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute requiredPerms={['production.view']}><Production /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute requiredPerms={['delivery.view']}><Delivery /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute requiredPerms={['customers.view']}><Customers /></ProtectedRoute>} />
      <Route path="/promotions" element={<ProtectedRoute requiredPerms={['promotions.view']}><Promotions /></ProtectedRoute>} />
      <Route path="/hr" element={<ProtectedRoute requiredPerms={['hr.view_employees']}><HR /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute requiredPerms={['reports.view']}><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requiredPerms={['settings.view']}><Settings /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute requiredPerms={['audit.view']}><AuditLog /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute requiredPerms={['integrations.view']}><Integrations /></ProtectedRoute>} />
      <Route path="/permissions" element={<ProtectedRoute requiredPerms={['permissions.manage']}><Permissions /></ProtectedRoute>} />
      <Route path="/docs" element={<ProtectedRoute requiredPerms={['dashboard.view']}><Docs /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute requiredPerms={['expenses.view']}><Expenses /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute requiredPerms={['suppliers.view']}><Suppliers /></ProtectedRoute>} />
      <Route path="/waste" element={<ProtectedRoute requiredPerms={['inventory.waste']}><WasteManagement /></ProtectedRoute>} />
      <Route path="/shifts" element={<ProtectedRoute requiredPerms={['hr.manage_shifts']}><Shifts /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute requiredPerms={['maintenance.view']}><Maintenance /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute requiredPerms={['accounting.view']}><Accounting /></ProtectedRoute>} />
      <Route path="/callcenter" element={<ProtectedRoute requiredPerms={['callcenter.view']}><CallCenter /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <AzkarWidget />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
