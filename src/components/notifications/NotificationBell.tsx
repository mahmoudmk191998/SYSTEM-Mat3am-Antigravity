import { useState } from 'react';
import { useNotificationsStore, AppNotification } from '@/lib/notifications.store';
import { Bell, CheckCircle, Info, AlertTriangle, XCircle, Trash2, Check, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { arEG } from 'date-fns/locale';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotificationsStore();
  const [open, setOpen] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'info':
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return 'bg-transparent border-transparent';
    switch (type) {
      case 'success': return 'bg-emerald-500/5 border-emerald-500/20';
      case 'warning': return 'bg-amber-500/5 border-amber-500/20';
      case 'error': return 'bg-rose-500/5 border-rose-500/20';
      case 'info':
      default: return 'bg-blue-500/5 border-blue-500/20';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-10 h-10 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm flex items-center justify-center hover:bg-accent/80 transition-all outline-none">
          <Bell className="w-5 h-5 text-foreground/80" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm shadow-rose-500/30 ring-2 ring-background animate-in zoom-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 md:w-96 p-0 rounded-2xl shadow-2xl border-border/50">
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-card/50">
          <h3 className="font-black text-lg">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs font-bold text-primary hover:bg-primary/10">
              <Check className="w-3 h-3 mr-1.5" />
              تحديد الكل كمقروء
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px] bg-background/30 backdrop-blur-md">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full sm:h-40 p-8 text-center opacity-70">
              <Bell className="w-10 h-10 text-muted-foreground mb-3 opacity-20" />
              <p className="text-sm font-bold text-muted-foreground">لا توجد إشعارات جديدة</p>
            </div>
          ) : (
            <div className="flex flex-col p-2 space-y-1">
              {notifications.map((notif: AppNotification) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={cn(
                    'group relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:bg-accent/50',
                    getNotificationBg(notif.type, notif.read)
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {getTypeIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <p className={cn("text-sm font-bold truncate leading-tight", notif.read ? "text-foreground/80" : "text-foreground")}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 font-semibold flex items-center gap-1 pt-1 opacity-80">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: arEG })}
                    </p>
                  </div>
                  
                  {/* Delete button appears on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-background/80 hover:text-rose-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="absolute top-1/2 left-3 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border/40 bg-card/50 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="w-full h-8 text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors rounded-xl"
            >
              مسح كل الإشعارات
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
