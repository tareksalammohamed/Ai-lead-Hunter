// ============================================================
// Auth Page — Sign in / Sign up
// ============================================================

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Input } from '@/components/ui';
import { Crosshair, Mail, Lock, User } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      toast(mode === 'signin' ? 'مرحباً بعودتك!' : 'تم إنشاء الحساب بنجاح!', 'success');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'rgb(var(--bg-primary))' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: 'rgb(var(--accent))' }}>
            <Crosshair className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>AI Lead Hunter</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>نظام البحث الذكي عن العملاء المحتملين</p>
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
            <button
              onClick={() => setMode('signin')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={mode === 'signin'
                ? { background: 'rgb(var(--bg-card))', color: 'rgb(var(--text-primary))', boxShadow: 'var(--shadow)' }
                : { color: 'rgb(var(--text-muted))' }}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setMode('signup')}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={mode === 'signup'
                ? { background: 'rgb(var(--bg-card))', color: 'rgb(var(--text-primary))', boxShadow: 'var(--shadow)' }
                : { color: 'rgb(var(--text-muted))' }}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  <input
                    className="input pr-10"
                    placeholder="محمد أحمد"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                <input
                  type="email"
                  className="input pr-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                <input
                  type="password"
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgb(var(--danger-soft))', color: 'rgb(var(--danger))' }}>
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {mode === 'signin' ? 'دخول' : 'إنشاء الحساب'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgb(var(--text-muted))' }}>
          AI Lead Hunter — منصة البحث الذكي عن العملاء
        </p>
      </div>
    </div>
  );
}
