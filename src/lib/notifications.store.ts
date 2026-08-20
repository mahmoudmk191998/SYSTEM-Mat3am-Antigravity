import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string; // ISO Date string
  link?: string;
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (payload) => {
        const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newNotification: AppNotification = {
          ...payload,
          id,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        // Fire toast automatically
        switch (payload.type) {
          case 'success':
            toast.success(payload.title, { description: payload.message });
            break;
          case 'error':
            toast.error(payload.title, { description: payload.message });
            break;
          case 'warning':
            toast.warning(payload.title, { description: payload.message });
            break;
          case 'info':
          default:
            toast.info(payload.title, { description: payload.message });
            break;
        }
      },

      markAsRead: (id) => {
        set((state) => {
          const notif = state.notifications.find((n) => n.id === id);
          if (!notif || notif.read) return state;

          return {
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notif = state.notifications.find((n) => n.id === id);
          const wasUnread = notif && !notif.read;
          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },
    }),
    {
      name: 'rms-notifications',
      // We only want to persist the state in localStorage, 
      // but maybe limit the number of notifications saved to avoid bloating local storage
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50), // keep only the latest 50
        unreadCount: state.unreadCount,
      }),
    }
  )
);
