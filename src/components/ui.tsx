// ============================================================
// UI Components — reusable building blocks
// ============================================================

import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

// ---- Button ----
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...props }: ButtonProps) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  }[variant];

  return (
    <button
      className={`btn ${variantClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---- Card ----
export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>{children}</div>;
}

// ---- Badge ----
export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = {
    default: 'background: rgb(var(--bg-secondary)); color: rgb(var(--text-secondary))',
    success: 'background: rgb(var(--success-soft)); color: rgb(var(--success))',
    warning: 'background: rgb(var(--warning-soft)); color: rgb(var(--warning))',
    danger: 'background: rgb(var(--danger-soft)); color: rgb(var(--danger))',
    info: 'background: rgb(var(--accent-soft)); color: rgb(var(--accent))',
  };
  return <span className="badge" style={{ background: colors[variant].split(';')[0].split(': ')[1], color: colors[variant].split(';')[1].split(': ')[1] }}>{children}</span>;
}

// ---- Score Badge ----
export function ScoreBadge({ score, tier }: { score: number; tier: string }) {
  const colors: Record<string, string> = {
    HOT: 'background: rgb(var(--danger-soft)); color: rgb(var(--danger))',
    HIGH: 'background: rgb(var(--success-soft)); color: rgb(var(--success))',
    MEDIUM: 'background: rgb(var(--warning-soft)); color: rgb(var(--warning))',
    LOW: 'background: rgb(var(--bg-secondary)); color: rgb(var(--text-muted))',
  };
  const style = colors[tier] ?? colors.LOW;
  return (
    <span
      className="badge font-bold"
      style={{ background: style.split(';')[0].split(': ')[1], color: style.split(';')[1].split(': ')[1] }}
    >
      {score} · {tier}
    </span>
  );
}

// ---- Empty State ----
export function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgb(var(--bg-secondary))' }}>
        <Icon className="w-8 h-8" style={{ color: 'rgb(var(--text-muted))' }} />
      </div>
      <h3 className="text-lg font-bold mb-1" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h3>
      {description && <p className="text-sm mb-4 max-w-md" style={{ color: 'rgb(var(--text-muted))' }}>{description}</p>}
      {action}
    </div>
  );
}

// ---- Skeleton ----
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

// ---- Modal ----
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className={`card w-full ${maxWidth} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h2>
          <button onClick={onClose} className="btn-ghost btn p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---- Input ----
export function Input({ label, error, ...props }: { label?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input className="input" {...props} />
      {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
    </div>
  );
}

// ---- Textarea ----
export function Textarea({ label, error, ...props }: { label?: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className="input" rows={props.rows ?? 3} {...props} />
      {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
    </div>
  );
}

// ---- Select ----
export function Select({ label, error, children, ...props }: { label?: string; error?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className="input" {...props}>{children}</select>
      {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
    </div>
  );
}

// ---- Toggle ----
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: checked ? 'rgb(var(--accent))' : 'rgb(var(--border))' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(2px)' : 'translateX(20px)' }}
        />
      </button>
      {label && <span className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</span>}
    </label>
  );
}

// ---- Progress Bar ----
export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-secondary))' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color ?? 'rgb(var(--accent))' }}
      />
    </div>
  );
}
