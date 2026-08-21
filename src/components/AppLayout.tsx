// ============================================================
// App Layout — Sidebar + main content area
// ============================================================

import { type ReactNode, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import {
  Crosshair, LayoutDashboard, Crosshair as Target, Users, Settings,
  LogOut, Moon, Sun, Menu, X, Activity, BarChart3, ChevronLeft,
} from 'lucide-react';

export type PageKey = 'dashboard' | 'campaigns' | 'agent' | 'leads' | 'analytics' | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: any;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { key: 'campaigns', label: 'الحملات', icon: Target },
  { key: 'agent', label: 'مركز التحكم', icon: Activity },
  { key: 'leads', label: 'العملاء', icon: Users },
  { key: 'analytics', label: 'التحليلات', icon: BarChart3 },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
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

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(var(--bg-primary))' }}>
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 right-0 h-screen w-64 flex-shrink-0 z-40 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        style={{ background: 'rgb(var(--bg-card))', borderLeft: '1px solid rgb(var(--border))' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgb(var(--accent))' }}>
              <Crosshair className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold truncate" style={{ color: 'rgb(var(--text-primary))' }}>AI Lead Hunter</h1>
              <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>البحث الذكي عن العملاء</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden btn-ghost btn p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={active
                    ? { background: 'rgb(var(--accent))', color: 'white' }
                    : { color: 'rgb(var(--text-secondary))' }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgb(var(--bg-secondary))'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-right">{item.label}</span>
                  {active && <ChevronLeft className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center gap-3 p-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                {user?.full_name?.[0] ?? user?.email?.[0] ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--text-primary))' }}>{user?.full_name ?? 'مستخدم'}</p>
                <p className="text-xs truncate" style={{ color: 'rgb(var(--text-muted))' }}>{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <button onClick={toggleTheme} className="btn btn-ghost flex-1 p-2" title="تبديل المظهر">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={handleSignOut} className="btn btn-ghost flex-1 p-2" title="تسجيل الخروج">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b sticky top-0 z-20" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))' }}>
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost p-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Crosshair className="w-6 h-6" style={{ color: 'rgb(var(--accent))' }} />
            <span className="font-bold text-sm" style={{ color: 'rgb(var(--text-primary))' }}>AI Lead Hunter</span>
          </div>
          <button onClick={toggleTheme} className="btn btn-ghost p-2">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
