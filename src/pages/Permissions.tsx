import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout';
import { cn } from '@/lib/utils';
import { db, firebaseConfig } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useTenantBranch } from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Shield, Users, UserPlus, Save, Search, Edit, Trash2, Eye,
  ShoppingCart, ChefHat, Package, Truck, BarChart3, Settings, FileText,
  CalendarDays, UtensilsCrossed, Percent, UserCog, Puzzle, LayoutDashboard, AlertTriangle, ChevronLeft
} from 'lucide-react';

const permissionCategories = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, permissions: [
    { id: 'dashboard.view', label: 'عرض لوحة التحكم والإحصائيات' },
  ]},
  { id: 'sales', label: 'المبيعات والعملاء (نقاط البيع)', icon: ShoppingCart, permissions: [
    { id: 'pos.view', label: 'استخدام نقاط البيع' }, { id: 'pos.create_order', label: 'إنشاء طلب' },
    { id: 'pos.edit_order', label: 'تعديل طلب' }, { id: 'pos.cancel_order', label: 'إلغاء طلب' },
    { id: 'pos.apply_discount', label: 'تطبيق خصم' }, { id: 'pos.refund', label: 'مرتجع' },
    { id: 'pos.open_drawer', label: 'فتح درج الكاشير' }, { id: 'pos.close_session', label: 'إغلاق الجلسة' },
    { id: 'orders.view', label: 'سجل الطلبات (عرض)' }, { id: 'orders.manage', label: 'إدارة وتعديل سجل الطلبات' },
    { id: 'customers.view', label: 'عرض العملاء' }, { id: 'customers.manage', label: 'إدارة العملاء' },
    { id: 'loyalty.view', label: 'برنامج الولاء (عرض)' }, { id: 'loyalty.manage', label: 'إدارة برنامج الولاء' },
    { id: 'promotions.view', label: 'العروض والخصومات (عرض)' }, { id: 'promotions.manage', label: 'إدارة العروض والخصومات' },
  ]},
  { id: 'kitchen', label: 'المطبخ والإنتاج والمنيو', icon: ChefHat, permissions: [
    { id: 'kitchen.view', label: 'شاشة المطبخ (عرض)' }, { id: 'kitchen.manage_orders', label: 'إدارة طلبات المطبخ' },
    { id: 'production.view', label: 'شاشة الإنتاج (عرض)' }, { id: 'production.manage', label: 'إدارة الإنتاج والتحضير' },
    { id: 'menu.view', label: 'القائمة والوصفات (عرض)' }, { id: 'menu.manage', label: 'إدارة الأصناف والوصفات' },
  ]},
  { id: 'inventory', label: 'المخزون والمشتريات', icon: Package, permissions: [
    { id: 'inventory.view', label: 'المخزون (عرض)' }, { id: 'inventory.add', label: 'إضافة أصناف جديدة للمخزون' },
    { id: 'inventory.edit', label: 'تعديل أصناف المخزون' }, { id: 'inventory.delete', label: 'حذف أصناف المخزون' },
    { id: 'inventory.adjust', label: 'المناقلات وتسوية المخزون' },
    { id: 'inventory.waste', label: 'تسجيل وإدارة الهالك والتوالف' },
    { id: 'purchasing.view', label: 'أوامر الشراء (عرض)' }, { id: 'purchasing.manage', label: 'إدارة وإنشاء أوامر شراء' },
    { id: 'suppliers.view', label: 'الموردين (عرض)' }, { id: 'suppliers.manage', label: 'إدارة الموردين' },
  ]},
  { id: 'operations', label: 'العمليات الداخلية (التوصيل والموظفين)', icon: CalendarDays, permissions: [
    { id: 'tables.view', label: 'الطاولات والحجوزات (عرض)' }, { id: 'tables.manage', label: 'إدارة وحجز الطاولات' },
    { id: 'callcenter.view', label: 'مركز الاتصالات (استخدام)' },
    { id: 'delivery.view', label: 'التوصيل والسائقين (عرض)' }, { id: 'delivery.manage', label: 'إدارة التوصيل والمناطق' },
    { id: 'hr.manage_shifts', label: 'إدارة الورديات وتعيين الدوام' },
    { id: 'hr.view_employees', label: 'الموارد البشرية والموظفين (عرض)' }, { id: 'hr.manage_employees', label: 'إدارة الموظفين والرواتب' },
  ]},
  { id: 'finance', label: 'المالية والتقارير', icon: BarChart3, permissions: [
    { id: 'reports.view', label: 'التقارير والتحليلات (عرض)' }, { id: 'reports.sales', label: 'تقارير المبيعات والأرباح' },
    { id: 'reports.inventory', label: 'تقارير حركة وجرد المخزون' },
    { id: 'accounting.view', label: 'الحسابات العامة والدفعات' },
    { id: 'expenses.view', label: 'المصروفات (عرض)' }, { id: 'expenses.manage', label: 'إدارة وسداد المصروفات' },
  ]},
  { id: 'settings', label: 'النظام والإعدادات', icon: Settings, permissions: [
    { id: 'settings.view', label: 'الإعدادات العامة للفرع' }, { id: 'settings.manage', label: 'تعديل الإعدادات المتقدمة' },
    { id: 'permissions.manage', label: 'الصلاحيات والمستخدمين (إدارة)' },
    { id: 'maintenance.view', label: 'الأصول والصيانة (عرض)' }, { id: 'maintenance.manage', label: 'إدارة الأصول والصيانة' },
    { id: 'integrations.view', label: 'مركز التكاملات' },
    { id: 'audit.view', label: 'سجل التدقيق والأمان' },
  ]},
];

const roleTemplates: Record<string, { label: string; permissions: string[] }> = {
  admin: { label: 'مدير (كل الصلاحيات)', permissions: permissionCategories.flatMap(c => c.permissions.map(p => p.id)) },
  cashier: { label: 'كاشير / فريق المبيعات', permissions: ['dashboard.view','pos.view','pos.create_order','tables.view','customers.view','promotions.view', 'callcenter.view'] },
  waiter: { label: 'نادل / مساعد ضيافة', permissions: ['pos.view','pos.create_order','tables.view','menu.view'] },
  chef: { label: 'شيف / المطبخ', permissions: ['kitchen.view','kitchen.manage_orders','production.view','production.manage','inventory.waste'] },
  inventory: { label: 'أمين مخزن', permissions: ['inventory.view','inventory.adjust','inventory.waste','purchasing.view','suppliers.view'] },
  hr: { label: 'مدير موارد بشرية', permissions: ['dashboard.view','hr.view_employees','hr.manage_employees','hr.manage_shifts'] },
  accountant: { label: 'المحاسب', permissions: ['dashboard.view','reports.view','reports.sales','reports.inventory','accounting.view','expenses.view','expenses.manage'] },
};

interface UserEntry {
  id: string;
  full_name: string;
  email: string;
  role: string;
  permissions: string[];
}

export default function Permissions() {
  const { user } = useAuth();
  const { tenantId, branchId } = useTenantBranch();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserEntry | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [showAddUser, setShowAddUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'cashier', customRole: '' });
  const [useGoogleAuth, setUseGoogleAuth] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // Custom roles management
  const [showEditRoleDialog, setShowEditRoleDialog] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!tenantId) return;
    const profilesQ = query(collection(db, 'profiles'), where('tenant_id', '==', tenantId));
    const profilesSnap = await getDocs(profilesQ);
    const profiles = profilesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    if (profiles.length === 0) { setLoading(false); return; }

    const userEntries: UserEntry[] = [];
    for (const p of profiles) {
      const rolesQ = query(collection(db, 'user_roles'), where('user_id', '==', p.id));
      const rolesSnap = await getDocs(rolesQ);
      const roles = rolesSnap.docs.map(d => d.data());

      const permsQ = query(collection(db, 'user_permissions'), where('user_id', '==', p.id));
      const permsSnap = await getDocs(permsQ);
      const perms = permsSnap.docs.map(d => d.data());

      const role = roles[0]?.role || 'user';
      userEntries.push({
        id: p.id,
        full_name: p.full_name,
        email: p.email || '',
        role,
        permissions: perms.map((x: any) => x.permission),
      });
    }
    setUsers(userEntries);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSelectUser = (u: UserEntry) => {
    setSelectedUser(u);
    setEditPermissions([...u.permissions]);
  };

  const togglePermission = (permId: string) => {
    setEditPermissions(prev => prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]);
  };

  const toggleCategory = (categoryId: string) => {
    const category = permissionCategories.find(c => c.id === categoryId);
    if (!category) return;
    const catPerms = category.permissions.map(p => p.id);
    const allEnabled = catPerms.every(p => editPermissions.includes(p));
    if (allEnabled) {
      setEditPermissions(prev => prev.filter(p => !catPerms.includes(p)));
    } else {
      setEditPermissions(prev => [...new Set([...prev, ...catPerms])]);
    }
  };

  const applyRoleTemplate = async (roleKey: string) => {
    if (roleKey === 'custom_role') {
      if (selectedUser) {
        setCustomRoleInput(roleTemplates[selectedUser.role]?.label || selectedUser.role);
        setShowEditRoleDialog(true);
      }
      return;
    }
    const template = roleTemplates[roleKey];
    if (template) {
      setEditPermissions([...template.permissions]);
      // Also update user role and permissions in Firestore to stay 100% synchronized
      if (selectedUser) {
        setLoading(true);
        try {
          // Update user role
          const rolesQ = query(collection(db, 'user_roles'), where('user_id', '==', selectedUser.id));
          const rolesSnap = await getDocs(rolesQ);
          for (const roleDoc of rolesSnap.docs) {
            await deleteDoc(roleDoc.ref);
          }
          await addDoc(collection(db, 'user_roles'), { user_id: selectedUser.id, role: roleKey as any });

          // Update user permissions to match template
          const permsQ = query(collection(db, 'user_permissions'), where('user_id', '==', selectedUser.id));
          const permsSnap = await getDocs(permsQ);
          for (const permDoc of permsSnap.docs) {
            await deleteDoc(permDoc.ref);
          }
          for (const p of template.permissions) {
            await addDoc(collection(db, 'user_permissions'), { user_id: selectedUser.id, permission: p, granted_by: user?.uid });
          }

          toast.success(`تم تطبيق قالب "${template.label}" وحفظ الصلاحيات بنجاح`);
          await fetchUsers();
          setSelectedUser(prev => prev ? { ...prev, role: roleKey, permissions: template.permissions } : null);
        } catch (e) {
          console.error("Error applying template:", e);
          toast.error("خطأ أثناء تطبيق قالب الصلاحيات");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    // Delete existing permissions for this user
    const permsQ = query(collection(db, 'user_permissions'), where('user_id', '==', selectedUser.id));
    const permsSnap = await getDocs(permsQ);
    for (const permDoc of permsSnap.docs) {
      await deleteDoc(permDoc.ref);
    }
    // Insert new permissions
    if (editPermissions.length > 0) {
      for (const p of editPermissions) {
        await addDoc(collection(db, 'user_permissions'), { user_id: selectedUser.id, permission: p, granted_by: user?.uid });
      }
    }
    toast.success(`تم حفظ صلاحيات ${selectedUser.full_name}`);
    await fetchUsers();
    // Update selected user
    setSelectedUser(prev => prev ? { ...prev, permissions: editPermissions } : null);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !branchId) return;
    
    let generatedPassword = newUserForm.password;
    if (useGoogleAuth) {
      // Auto-generate a highly secure random password so the user can only log in via Google
      generatedPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + "Aa1@";
    } else if (generatedPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    setAddingUser(true);
    try {
      // Use a secondary app so we don't log out the current admin
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserForm.email, generatedPassword);
      await updateProfile(userCredential.user, { displayName: newUserForm.name });
      
      const newUserId = userCredential.user.uid;
      
      // Add profile
      await setDoc(doc(db, 'profiles', newUserId), {
        full_name: newUserForm.name,
        email: newUserForm.email,
        tenant_id: tenantId,
        branch_id: branchId
      });

      // Add role
      const finalRole = newUserForm.role === 'custom_role' ? newUserForm.customRole.trim() : newUserForm.role;
      await addDoc(collection(db, 'user_roles'), { user_id: newUserId, role: finalRole });

      // Add permissions
      const template = roleTemplates[finalRole];
      if (template) {
        for (const p of template.permissions) {
          await addDoc(collection(db, 'user_permissions'), { user_id: newUserId, permission: p, granted_by: user?.uid });
        }
      }

      await secondaryAuth.signOut();
      
      toast.success(useGoogleAuth ? 'تمت إضافة الموظف بنجاح. يمكنه الآن تسجيل الدخول بحساب جوجل مباشرة.' : 'تمت إضافة المستخدم بنجاح');
      setShowAddUser(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'cashier', customRole: '' });
      setUseGoogleAuth(false);
      await fetchUsers();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'خطأ أثناء إضافة المستخدم');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setDeletingUser(true);
    try {
      // Delete from user_roles
      const rolesQ = query(collection(db, 'user_roles'), where('user_id', '==', selectedUser.id));
      const rolesSnap = await getDocs(rolesQ);
      for (const roleDoc of rolesSnap.docs) {
        await deleteDoc(roleDoc.ref);
      }
      
      // Delete from user_permissions
      const permsQ = query(collection(db, 'user_permissions'), where('user_id', '==', selectedUser.id));
      const permsSnap = await getDocs(permsQ);
      for (const permDoc of permsSnap.docs) {
        await deleteDoc(permDoc.ref);
      }

      // Delete profile doc
      await deleteDoc(doc(db, 'profiles', selectedUser.id));

      toast.success('تم حذف المستخدم وصلاحياته بنجاح');
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('حدث خطأ أثناء محاولة حذف المستخدم');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleSaveCustomRole = async () => {
    if (!selectedUser || !customRoleInput.trim()) return;
    setSavingRole(true);
    try {
      const rolesQ = query(collection(db, 'user_roles'), where('user_id', '==', selectedUser.id));
      const rolesSnap = await getDocs(rolesQ);
      for (const roleDoc of rolesSnap.docs) {
        await deleteDoc(roleDoc.ref);
      }
      await addDoc(collection(db, 'user_roles'), { user_id: selectedUser.id, role: customRoleInput.trim() });
      
      toast.success(`تم تغيير مسمى الوظيفة إلى "${customRoleInput.trim()}" بنجاح`);
      setShowEditRoleDialog(false);
      await fetchUsers();
      setSelectedUser(prev => prev ? { ...prev, role: customRoleInput.trim() } : null);
    } catch (err: any) {
      console.error("Error saving custom role:", err);
      toast.error("حدث خطأ أثناء تعديل مسمى الوظيفة");
    } finally {
      setSavingRole(false);
    }
  };

  const filteredUsers = users.filter(u => (u.full_name || '').includes(searchTerm) || (u.email || '').includes(searchTerm));

  return (
    <MainLayout title="إدارة الصلاحيات" subtitle="تحكم احترافي متقدم في صلاحيات كل مستخدم">
      <div className="grid gap-6 lg:grid-cols-12 h-[calc(100vh-180px)] min-h-[600px] mb-8">
        {/* Users List Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="البحث عن مستخدم..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pr-11 h-12 rounded-2xl bg-card/60 backdrop-blur-md border-white/5 focus-visible:ring-primary/30 shadow-sm" 
              />
            </div>
            <Button onClick={() => setShowAddUser(true)} size="icon" className="h-12 w-12 shrink-0 rounded-2xl bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all">
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 pb-6 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm">جاري جلب القائمة...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-card/30 rounded-3xl border border-dashed border-border/50">
                <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="font-medium text-muted-foreground">لم يتم العثور على مستخدمين</p>
              </div>
            ) : (
              filteredUsers.map((u, i) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <div 
                    key={u.id} 
                    onClick={() => handleSelectUser(u)}
                    style={{ animationDelay: `${i * 30}ms` }}
                    className={cn(
                      "group relative p-4 rounded-3xl cursor-pointer transition-all duration-300 border overflow-hidden animate-fade-in",
                      isSelected 
                        ? "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-[0_8px_30px_-10px_rgba(var(--primary),0.2)]" 
                        : "bg-card/40 border-border/40 hover:bg-card/80 hover:border-border hover:shadow-md"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
                    )}
                    
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-500",
                          isSelected ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.4)] scale-110" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary scale-100"
                        )}>
                          <span className="font-bold text-lg">{(u.full_name || u.email || '?').charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <h3 className={cn("font-bold text-sm tracking-wide transition-colors", isSelected ? "text-primary" : "text-foreground group-hover:text-primary")}>
                            {u.full_name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-medium" dir="ltr">{u.email}</p>
                        </div>
                      </div>
                      
                      <Badge variant="secondary" className={cn(
                        "text-[10px] uppercase font-bold tracking-wider px-2",
                        isSelected ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/50 text-muted-foreground"
                      )}>
                        {roleTemplates[u.role]?.label?.split(' ')[0] || u.role}
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
                        <Shield className={cn("w-3.5 h-3.5", isSelected && "text-primary")} />
                        <span>{u.permissions.length} صلاحية مفعلة</span>
                      </div>
                      
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                        isSelected ? "bg-primary text-primary-foreground translate-x-0 opacity-100 shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-muted text-muted-foreground -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      )}>
                        <ChevronLeft className="w-4 h-4 ml-0.5" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Details Panel */}
        <div className="lg:col-span-8 flex flex-col">
          {selectedUser ? (
            <div className="flex flex-col h-full bento-card border border-white/5 relative overflow-hidden p-0 animate-fade-in shadow-xl">
              {/* Header Gradient */}
              <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
              
              <div className="p-6 md:p-8 flex-shrink-0 border-b border-border/50 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-card/30 backdrop-blur-3xl">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-[2px] shadow-[0_0_30px_rgba(var(--primary),0.4)] relative group cursor-default">
                    <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-full h-full rounded-[14px] bg-card/90 backdrop-blur-sm flex items-center justify-center relative">
                      <Shield className="w-8 h-8 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-foreground drop-shadow-sm">{selectedUser.full_name || selectedUser.email || 'بدون اسم'}</h2>
                    <p className="text-sm font-medium text-muted-foreground mt-1.5 flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="border-primary/30 text-primary bg-primary/5 font-bold cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                        onClick={() => {
                          setCustomRoleInput(roleTemplates[selectedUser.role]?.label || selectedUser.role);
                          setShowEditRoleDialog(true);
                        }}
                        title="اضغط لتعديل مسمى الوظيفة"
                      >
                        {roleTemplates[selectedUser.role]?.label || selectedUser.role}
                        <Edit className="w-3 h-3 opacity-70" />
                      </Badge>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                      <span className="text-primary/80 font-bold">{editPermissions.length} إذن نشط</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Select onValueChange={applyRoleTemplate}>
                    <SelectTrigger className="w-[180px] h-11 rounded-xl bg-card border-border/60 hover:border-primary/50 transition-colors font-semibold">
                      <SelectValue placeholder="تطبيق قالب جاهز..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-cairo">
                      {Object.entries(roleTemplates).map(([key, val]) => (
                        <SelectItem key={key} value={key} className="cursor-pointer">{val.label}</SelectItem>
                      ))}
                      <SelectItem value="custom_role" className="cursor-pointer font-bold text-primary">تخصيص مسمى الوظيفة...</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button onClick={savePermissions} className="h-11 rounded-xl gap-2 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all text-sm px-6">
                    <Save className="w-4 h-4" />
                    حفظ التغييرات
                  </Button>
                  
                  <Button variant="outline" size="icon" className="h-11 w-11 text-destructive border-transparent hover:border-destructive/30 hover:bg-destructive/10 rounded-xl transition-all ml-1" onClick={() => setShowDeleteConfirm(true)} title="إزالة المستخدم">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Permissions List */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 custom-scrollbar pb-10">
                <div className="grid gap-6">
                  {permissionCategories.map((category, index) => {
                    const Icon = category.icon;
                    const catPerms = category.permissions.map(p => p.id);
                    const enabledCount = catPerms.filter(p => editPermissions.includes(p)).length;
                    const allEnabled = enabledCount === catPerms.length;
                    const ProgressPercent = (enabledCount / catPerms.length) * 100;

                    return (
                      <div 
                        key={category.id} 
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="group rounded-3xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-lg animate-fade-in"
                      >
                        {/* Category Header */}
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 bg-gradient-to-l from-transparent via-muted/10 to-muted/30">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                              enabledCount > 0 ? "bg-primary/10 text-primary shadow-inner scale-105" : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary/70"
                            )}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-bold text-base tracking-wide">{category.label}</h3>
                              <div className="flex items-center gap-3 mt-2">
                                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 h-5 bg-background">
                                  {enabledCount} / {catPerms.length}
                                </Badge>
                                <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden relative">
                                  <div 
                                    className={cn(
                                      "h-full transition-all duration-700 ease-out relative",
                                      allEnabled ? "bg-success" : "bg-primary"
                                    )} 
                                    style={{ width: `${ProgressPercent}%` }}
                                  >
                                    <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded-xl border border-border/50">
                            <span className="text-sm font-bold text-muted-foreground">تفعيل الكل</span>
                            <Switch 
                              checked={allEnabled} 
                              onCheckedChange={() => toggleCategory(category.id)} 
                              className={cn(
                                "data-[state=checked]:bg-success data-[state=checked]:shadow-[0_0_10px_rgba(var(--success),0.5)] transition-all",
                                !allEnabled && enabledCount > 0 && "data-[state=unchecked]:bg-primary/50"
                              )}
                            />
                          </div>
                        </div>

                        {/* Category Items */}
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          {category.permissions.map(perm => {
                            const isChecked = editPermissions.includes(perm.id);
                            return (
                              <div 
                                key={perm.id} 
                                className={cn(
                                  "flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 border border-transparent cursor-pointer",
                                  isChecked 
                                    ? "bg-primary/5 border-primary/10 shadow-sm" 
                                    : "bg-muted/30 hover:bg-muted/50 border-border/30 hover:shadow-sm"
                                )}
                                onClick={() => togglePermission(perm.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] transition-all duration-300 relative",
                                    isChecked ? "bg-primary text-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" : "bg-muted-foreground/30 text-transparent"
                                  )}>
                                    {isChecked && <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-40" />}
                                  </div>
                                  <span className={cn(
                                    "text-sm font-bold transition-colors select-none",
                                    isChecked ? "text-foreground drop-shadow-sm" : "text-muted-foreground/80"
                                  )}>{perm.label}</span>
                                </div>
                                <Switch 
                                  checked={isChecked} 
                                  onCheckedChange={() => togglePermission(perm.id)} 
                                  onClick={(e) => e.stopPropagation()}
                                  className="scale-[0.85] pointer-events-none data-[state=checked]:shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex-1 flex items-center justify-center rounded-[32px] border border-dashed border-border/60 bg-card/20 backdrop-blur-sm">
              <div className="text-center p-8 max-w-md animate-fade-in flex flex-col items-center">
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent border border-primary/10 flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(var(--primary),0.1)] relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-100 transition-duration-700" />
                  <Shield className="w-14 h-14 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)] transition-transform duration-500 group-hover:scale-110" />
                </div>
                <h3 className="text-3xl font-black text-foreground mb-4 drop-shadow-sm">مركز الأمان والصلاحيات</h3>
                <p className="text-muted-foreground leading-relaxed text-sm font-medium px-4">
                  اختر حساباً من القائمة الجانبية أو أضف موظفاً جديداً لبناء وتخصيص صلاحيات محكمة تتناسب مع مسؤولياته الوظيفية.
                </p>
                <Button onClick={() => setShowAddUser(true)} className="mt-8 rounded-2xl px-8 h-12 shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)] hover:shadow-[0_10px_40px_-5px_rgba(var(--primary),0.6)] hover:-translate-y-1 transition-all group font-bold text-base">
                  <UserPlus className="w-5 h-5 ml-2 transition-transform group-hover:scale-110" />
                  إضافة مستخدم جديد
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={newUserForm.name} onChange={e => setNewUserForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label>تسجيل الدخول عبر جوجل (Gmail)</Label>
                <div className="text-xs text-muted-foreground">
                  السماح للموظف بالدخول بحساب جوجل مباشرة بدون كلمة مرور
                </div>
              </div>
              <Switch checked={useGoogleAuth} onCheckedChange={setUseGoogleAuth} />
            </div>

            <div className="space-y-2">
              <Label>{useGoogleAuth ? 'بريد الـ Gmail' : 'البريد الإلكتروني'}</Label>
              <Input type="email" value={newUserForm.email} onChange={e => setNewUserForm(f => ({ ...f, email: e.target.value }))} required dir="ltr" placeholder={useGoogleAuth ? "employee@gmail.com" : ""} />
            </div>

            {!useGoogleAuth && (
              <div className="space-y-2">
                <Label>كلمة المرور المبدئية</Label>
                <Input type="text" value={newUserForm.password} onChange={e => setNewUserForm(f => ({ ...f, password: e.target.value }))} required={!useGoogleAuth} dir="ltr" />
              </div>
            )}

            <div className="space-y-2">
              <Label>الوظيفة (الصلاحية)</Label>
              <Select value={newUserForm.role} onValueChange={v => setNewUserForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الوظيفة" /></SelectTrigger>
                <SelectContent className="font-cairo">
                  {Object.entries(roleTemplates).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                  <SelectItem value="custom_role" className="font-bold text-primary">دور/مسمى مخصص...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newUserForm.role === 'custom_role' && (
              <div className="space-y-2 animate-fade-in">
                <Label>المسمى الوظيفي المخصص</Label>
                <Input 
                  value={newUserForm.customRole} 
                  onChange={e => setNewUserForm(f => ({ ...f, customRole: e.target.value }))} 
                  placeholder="مثال: مشرف مبيعات، موظف استقبال..." 
                  required 
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>إلغاء</Button>
              <Button type="submit" disabled={addingUser}>{addingUser ? 'جاري الإضافة...' : 'إضافة الموظف'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="w-5 h-5 mr-2" />
              تأكيد عملية الحذف
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm">هل أنت متأكد من رغبتك في مسح المستخدم <strong>{selectedUser?.full_name}</strong>؟</p>
            <p className="text-sm text-muted-foreground">هذا الإجراء سيقوم بحذف مسار هذا الموظف من النظام نهائياً ولا يمكن التراجع عنه.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deletingUser}>
              {deletingUser ? 'جاري الحذف...' : 'تأكيد الحذف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditRoleDialog} onOpenChange={setShowEditRoleDialog}>
        <DialogContent className="max-w-sm font-cairo">
          <DialogHeader>
            <DialogTitle>تعديل المسمى الوظيفي للموظف</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>المسمى الوظيفي (الدور)</Label>
              <Input 
                value={customRoleInput} 
                onChange={e => setCustomRoleInput(e.target.value)} 
                placeholder="مثال: مشرف مبيعات، موظف توصيل..."
                required
              />
              <p className="text-xs text-muted-foreground font-medium">
                تغيير مسمى الوظيفة لا يؤثر على صلاحيات الموظف الحالية. يمكنك تخصيص الصلاحيات بالأسفل.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEditRoleDialog(false)}>إلغاء</Button>
              <Button onClick={handleSaveCustomRole} disabled={savingRole}>
                {savingRole ? 'جاري الحفظ...' : 'حفظ المسمى'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
