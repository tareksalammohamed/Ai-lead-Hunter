// ============================================================
// AI Lead Hunter — Production App Shell / Responsive UX
// Web + Capacitor (Android / iOS)
// ============================================================

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Crosshair, LayoutDashboard, Target, Users, Settings, LogOut, Moon, Sun,
  Menu, X, Activity, BarChart3, ChevronLeft, Search, Plus, Command,
} from 'lucide-react';

export type PageKey = 'dashboard' | 'campaigns' | 'agent' | 'leads' | 'analytics' | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: any;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, description: 'نظرة سريعة على الأداء' },
  { key: 'campaigns', label: 'الحملات', icon: Target, description: 'إنشاء وإدارة حملات البحث' },
  { key: 'agent', label: 'مركز التحكم', icon: Activity, description: 'تشغيل ومتابعة البحث الذكي' },
  { key: 'leads', label: 'العملاء المحتملون', icon: Users, description: 'استعراض وتأهيل العملاء' },
  { key: 'analytics', label: 'التحليلات', icon: BarChart3, description: 'تقارير ومؤشرات الأداء' },
  { key: 'settings', label: 'الإعدادات', icon: Settings, description: 'إعدادات الحساب والتطبيق' },
];

interface AppLayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

export function AppLayout({ currentPage, onNavigate, children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const currentItem = useMemo(
    () => NAV_ITEMS.find((item) => item.key === currentPage) ?? NAV_ITEMS[0],
    [currentPage],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommand = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isCommand) {
        event.preventDefault();
        document.getElementById('global-app-search')?.focus();
      }
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        const el = document.getElementById('global-app-search') as HTMLInputElement | null;
        if (el) el.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const runSearch = () => {
    if (search.trim()) onNavigate('leads');
  };

  const initials = (user?.full_name ?? user?.email ?? 'U').trim().slice(0, 1).toUpperCase();

  return (
    <div className="app-shell min-h-screen flex" style={{ background: 'rgb(var(--bg-primary))' }}>
      {/* Desktop / tablet sidebar */}
      <aside
        className={`app-sidebar fixed lg:sticky top-0 right-0 h-[100dvh] w-[272px] flex-shrink-0 z-50 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        aria-label="التنقل الرئيسي"
      >
        <div className="flex flex-col h-full">
          <div className="app-brand px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="brand-mark">
                <Crosshair className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-extrabold tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>
                  AI Lead Hunter
                </h1>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                  منصة البحث الذكي
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="btn btn-ghost p-2 lg:hidden"
                aria-label="إغلاق القائمة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'rgb(var(--text-muted))' }}>
              مساحة العمل
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                  className={`app-nav-item w-full ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  title={item.description}
                >
                  <span className="app-nav-icon"><Icon className="w-[18px] h-[18px]" /></span>
                  <span className="flex-1 text-right">{item.label}</span>
                  {active && <ChevronLeft className="w-4 h-4 opacity-80" />}
                </button>
              );
            })}
          </nav>

          <div className="p-3">
            <div className="app-user-card">
              <div className="flex items-center gap-3">
                <div className="user-avatar">{initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                    {user?.full_name ?? 'مستخدم'}
                  </p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 mt-3">
                <button onClick={toggleTheme} className="btn btn-ghost flex-1 h-10" title="تبديل المظهر">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span className="text-xs">{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
                </button>
                <button onClick={signOut} className="btn btn-ghost h-10 px-3" title="تسجيل الخروج" aria-label="تسجيل الخروج">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden app-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Global top bar */}
        <header className="app-topbar sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost p-2 lg:hidden" aria-label="فتح القائمة">
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:block min-w-0">
              <p className="text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>مساحة العمل</p>
              <h2 className="text-sm font-bold truncate" style={{ color: 'rgb(var(--text-primary))' }}>{currentItem.label}</h2>
            </div>
          </div>

          <div className="app-global-search">
            <Search className="w-4 h-4 shrink-0" style={{ color: 'rgb(var(--text-muted))' }} />
            <input
              id="global-app-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder="ابحث عن عميل أو انتقل للعملاء..."
              aria-label="البحث السريع"
            />
            <kbd className="hidden md:inline-flex"><Command className="w-3 h-3" />K</kbd>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => onNavigate('campaigns')} className="btn btn-primary hidden sm:inline-flex h-10 px-3" title="إنشاء حملة جديدة">
              <Plus className="w-4 h-4" /> حملة جديدة
            </button>
            <button onClick={toggleTheme} className="btn btn-ghost p-2.5 h-10 w-10" aria-label="تبديل المظهر">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="page-transition">{children}</div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="mobile-bottom-nav lg:hidden" aria-label="التنقل السريع">
          {NAV_ITEMS.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`mobile-nav-item ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-[19px] h-[19px]" />
                <span>{item.key === 'dashboard' ? 'الرئيسية' : item.key === 'leads' ? 'العملاء' : item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
