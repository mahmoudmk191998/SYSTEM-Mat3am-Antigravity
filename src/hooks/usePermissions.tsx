import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './useAuth';

export function useUserPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let currentRoles: string[] = [];
    let currentPerms: string[] = [];
    let rolesLoaded = false;
    let permsLoaded = false;

    const updatePermissionsState = (userRoles: string[], userPerms: string[]) => {
      setRoles(userRoles);
      if (userRoles.includes('admin') || userRoles.includes('super_admin')) {
        setPermissions(['*']); // wildcard = all permissions
      } else {
        setPermissions(userPerms);
      }
      if (rolesLoaded && permsLoaded) {
        setLoading(false);
      }
    };

    // Listen to user roles
    const rolesRef = collection(db, 'user_roles');
    const rolesQ = query(rolesRef, where('user_id', '==', user.uid));
    
    const unsubscribeRoles = onSnapshot(rolesQ, (snapshot) => {
      currentRoles = snapshot.docs.map(doc => doc.data().role);
      rolesLoaded = true;
      updatePermissionsState(currentRoles, currentPerms);
    }, (error) => {
      console.error("Error listening to user roles:", error);
      rolesLoaded = true;
      if (rolesLoaded && permsLoaded) setLoading(false);
    });

    // Listen to granular permissions
    const permsRef = collection(db, 'user_permissions');
    const permsQ = query(permsRef, where('user_id', '==', user.uid));

    const unsubscribePerms = onSnapshot(permsQ, (snapshot) => {
      currentPerms = snapshot.docs.map(doc => doc.data().permission);
      permsLoaded = true;
      updatePermissionsState(currentRoles, currentPerms);
    }, (error) => {
      console.error("Error listening to user permissions:", error);
      permsLoaded = true;
      if (rolesLoaded && permsLoaded) setLoading(false);
    });

    return () => {
      unsubscribeRoles();
      unsubscribePerms();
    };
  }, [user]);

  const hasPermission = useCallback((perm: string) => {
    if (permissions.includes('*')) return true;
    return permissions.includes(perm);
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: string[]) => {
    if (permissions.includes('*')) return true;
    return perms.some(p => permissions.includes(p));
  }, [permissions]);

  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const hasAnyRole = roles.length > 0;

  const refresh = useCallback(() => {}, []);

  return { permissions, roles, loading, hasPermission, hasAnyPermission, isAdmin, hasAnyRole, refresh };
}

export const routePermissions: Record<string, string[]> = {
  '/': ['dashboard.view'],
  '/pos': ['pos.view'],
  '/kitchen': ['kitchen.view'],
  '/tables': ['tables.view'],
  '/menu': ['menu.view'],
  '/inventory': ['inventory.view'],
  '/waste': ['inventory.waste'],
  '/purchasing': ['purchasing.view'],
  '/production': ['production.view'],
  '/delivery': ['delivery.view'],
  '/callcenter': ['callcenter.view'],
  '/customers': ['customers.view'],
  '/loyalty': ['loyalty.view'],
  '/promotions': ['promotions.view'],
  '/shifts': ['hr.manage_shifts'],
  '/hr': ['hr.view_employees'],
  '/reports': ['reports.view'],
  '/accounting': ['accounting.view'],
  '/expenses': ['expenses.view'],
  '/settings': ['settings.view'],
  '/permissions': ['permissions.manage'],
  '/maintenance': ['maintenance.view'],
  '/integrations': ['integrations.view'],
  '/audit': ['audit.view'],
  '/docs': ['dashboard.view'],
};
