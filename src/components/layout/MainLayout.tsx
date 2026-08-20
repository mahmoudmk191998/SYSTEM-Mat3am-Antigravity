import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useProfile } from '@/hooks/useProfile';
import { Sidebar, SidebarContent } from './Sidebar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { User, Wifi, WifiOff, LogOut, Moon, Sun, Lock, Clock, CalendarDays, Download, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { formatDate } from '@/lib/formatters';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  let hoursNum = time.getHours();
  const ampm = hoursNum >= 12 ? 'م' : 'ص';
  hoursNum = hoursNum % 12 || 12; // convert to 12-hour format
  
  const hours = hoursNum.toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');

  const gregorianDate = new Intl.DateTimeFormat('ar-EG', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }).format(time);

  return (
    <div className="hidden xl:flex items-center gap-1.5 p-1 rounded-full bg-gradient-to-r from-background to-secondary/10 border border-border/40 shadow-sm backdrop-blur-md group hover:border-primary/30 transition-all duration-300 hover:shadow-md">
      
      {/* Date Badge */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 shadow-inner">
        <CalendarDays className="w-3.5 h-3.5 text-primary opacity-80" />
        <span className="text-[12px] font-extrabold text-foreground/80 tracking-wide mt-0.5">{gregorianDate}</span>
      </div>

      {/* Internal Divider */}
      <div className="w-px h-4 bg-border/60 mx-0.5 opacity-50" />

      {/* Time Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 shadow-inner" dir="ltr">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform shadow-sm">
          <Clock className="w-3 h-3" />
        </div>
        <div className="flex items-center font-mono font-bold tracking-wider text-slate-800 dark:text-slate-200 mt-0.5">
          <span className="text-[13px]">{hours}</span>
          <span className="text-primary/70 animate-[pulse_1.5s_ease-in-out_infinite] mx-0.5">:</span>
          <span className="text-[13px]">{minutes}</span>
          <span className="text-primary/70 animate-[pulse_1.5s_ease-in-out_infinite] mx-0.5">:</span>
          <span className="text-[11px] text-muted-foreground font-medium opacity-80 drop-shadow-sm">{seconds}</span>
        </div>
        <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded shadow-sm ml-1 mt-0.5">{ampm}</span>
      </div>

    </div>
  );
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const { sidebarCollapsed, settings } = useAppStore();
  const isMobile = useIsMobile();
  const isOnline = navigator.onLine;
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.full_name || (user as any)?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0) || 'U';

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn("min-h-screen pb-28 pt-4 px-2 md:px-6 w-full max-w-[1800px] mx-auto relative")}
      >
        {/* Top Header */}
        <header className={cn(
          "sticky top-0 z-40 transition-all duration-500",
          isMobile 
            ? "glass border-b border-border/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)]" 
            : "mt-4 mx-6 rounded-[24px] glass-panel shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
        )}>
          <div className="flex items-center justify-between px-4 md:px-6 h-16 md:h-20">
            {/* Title Section */}
            <div className="min-w-0 flex-1 flex items-center gap-3">
              {isMobile && (
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl hover:bg-muted/80">
                      <Menu className="w-5 h-5 text-foreground" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="p-0 w-72 border-l border-border/40 font-cairo">
                    <SheetTitle className="sr-only">قائمة التنقل</SheetTitle>
                    <SheetDescription className="sr-only">عناصر التنقل للنظام</SheetDescription>
                    <SidebarContent isMobile={true} onNavigate={() => setMenuOpen(false)} />
                  </SheetContent>
                </Sheet>
              )}
              <div className="flex flex-col min-w-0">
                {title && <h1 className="text-lg md:text-2xl font-black bg-gradient-to-l from-foreground to-foreground/70 bg-clip-text text-transparent truncate tracking-tight">{title}</h1>}
                {subtitle && <p className="text-[13px] text-muted-foreground truncate hidden sm:block font-medium mt-0.5 opacity-80">{subtitle}</p>}
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-3 md:gap-5 flex-shrink-0">
              {!isMobile && actions}

              {/* Status & Time Group */}
              <div className="hidden lg:flex items-center gap-3 mr-2 border-l border-border/50 pl-4">
                {/* Live Clock Component */}
                <LiveClock />

                {/* Connection Status Pill */}
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm border transition-all duration-300', 
                  isOnline 
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                )}>
                  {isOnline ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>متصل</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>غير متصل</span>
                    </>
                  )}
                </div>
              </div>

              {/* Install App Button */}
              {deferredPrompt && (
                <Button 
                  onClick={handleInstallClick} 
                  variant="default" 
                  size="sm" 
                  className="hidden sm:flex gap-2 rounded-full shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  تثبيت النظام
                </Button>
              )}

              {/* Notification Bell */}
              <NotificationBell />

              {/* Theme Toggle */}
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-full border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 bg-background/50 backdrop-blur-sm" 
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500 animate-in spin-in-12" /> : <Moon className="w-4 h-4 text-indigo-500 animate-in spin-in-12" />}
              </Button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 p-1 lg:pl-4 rounded-full border border-border/50 shadow-sm bg-background/50 hover:bg-accent/80 hover:shadow-md transition-all duration-300 gap-3 group outline-none overflow-hidden">
                    <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-tr from-primary to-primary/80 shadow-md text-primary-foreground flex items-center justify-center font-bold text-sm border border-white/20 group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <span className="hidden lg:inline text-[13px] font-bold text-foreground truncate">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-2 rounded-2xl shadow-2xl border-border/50 backdrop-blur-xl bg-background/95">
                  <DropdownMenuLabel className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {initials}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate">{displayName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="opacity-50" />
                  <div className="p-1">
                    <DropdownMenuItem className="rounded-xl px-3 py-2.5 cursor-pointer text-[13px] font-medium transition-colors hover:bg-primary/5 hover:text-primary">
                      <User className="w-4 h-4 ml-2 opacity-70" />
                      إعدادات الحساب
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl px-3 py-2.5 cursor-pointer text-[13px] font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600 focus:bg-red-500/10 focus:text-red-600 mt-1" onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 ml-2 opacity-70" />
                      تسجيل الخروج
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </div>
          {/* Mobile Actions Below Header */}
          {isMobile && actions && (
            <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">{actions}</div>
          )}
        </header>

        <div className="p-3 md:p-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
