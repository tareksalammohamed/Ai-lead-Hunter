// ============================================================
// Auth Page — Sign in / Sign up / Password recovery
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';

interface AuthPageProps {
  recovery?: boolean;
}

export function AuthPage({ recovery = false }: AuthPageProps) {
  const { signIn, signUp, resetPassword, updatePassword, isRecoverySession } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>(recovery || isRecoverySession ? 'recovery' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (recovery || isRecoverySession) setMode('recovery');
  }, [recovery, isRecoverySession]);

  const switchMode = (nextMode: AuthMode) => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result: { error?: string };
    if (mode === 'forgot') {
      result = await resetPassword(email);
    } else if (mode === 'recovery') {
      if (password !== confirmPassword) {
        setLoading(false);
        setError('كلمتا المرور غير متطابقتين');
        return;
      }
      result = await updatePassword(password);
    } else if (mode === 'signin') {
      result = await signIn(email, password);
    } else {
      result = await signUp(email, password, fullName);
    }

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === 'forgot') {
      toast('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني', 'success');
      setMode('signin');
    } else if (mode === 'recovery') {
      toast('تم تغيير كلمة المرور بنجاح', 'success');
      setPassword('');
      setConfirmPassword('');
    } else {
      toast(mode === 'signin' ? 'مرحباً بعودتك!' : 'تم إنشاء الحساب بنجاح!', 'success');
    }
  };

  const isRecovery = mode === 'recovery';
  const isForgot = mode === 'forgot';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'rgb(var(--bg-primary))' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl overflow-hidden mb-4 shadow-lg ring-4 ring-white/10">
            <img src="/icons/app-icon-192.png" alt="AI Lead Hunter" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>AI Lead Hunter</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>نظام البحث الذكي عن العملاء المحتملين</p>
        </div>

        <div className="card p-6">
          {isRecovery ? (
            <div className="mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>تعيين كلمة مرور جديدة</h2>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>أدخل كلمة المرور الجديدة لحسابك.</p>
            </div>
          ) : isForgot ? (
            <div className="mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>استعادة كلمة المرور</h2>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>سنرسل رابطاً آمناً إلى بريدك الإلكتروني.</p>
            </div>
          ) : (
            <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: 'rgb(var(--bg-secondary))' }}>
              <button
                onClick={() => switchMode('signin')}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={mode === 'signin'
                  ? { background: 'rgb(var(--bg-card))', color: 'rgb(var(--text-primary))', boxShadow: 'var(--shadow)' }
                  : { color: 'rgb(var(--text-muted))' }}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => switchMode('signup')}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={mode === 'signup'
                  ? { background: 'rgb(var(--bg-card))', color: 'rgb(var(--text-primary))', boxShadow: 'var(--shadow)' }
                  : { color: 'rgb(var(--text-muted))' }}
              >
                حساب جديد
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  <input className="input pr-10" placeholder="محمد أحمد" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              </div>
            )}

            {!isRecovery && (
              <div>
                <label className="label">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  <input type="email" className="input pr-10" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="label">{isRecovery ? 'كلمة المرور الجديدة' : 'كلمة المرور'}</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  <input type="password" className="input pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
              </div>
            )}

            {isRecovery && (
              <div>
                <label className="label">تأكيد كلمة المرور الجديدة</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--text-muted))' }} />
                  <input type="password" className="input pr-10" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgb(var(--danger-soft))', color: 'rgb(var(--danger))' }}>
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {isRecovery ? 'حفظ كلمة المرور الجديدة' : isForgot ? 'إرسال رابط الاستعادة' : mode === 'signin' ? 'دخول' : 'إنشاء الحساب'}
            </Button>
          </form>

          {mode === 'signin' && (
            <button type="button" onClick={() => switchMode('forgot')} className="w-full mt-4 text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: 'rgb(var(--accent))' }}>
              نسيت كلمة المرور؟
            </button>
          )}

          {(isForgot || isRecovery) && (
            <button type="button" onClick={() => switchMode('signin')} className="w-full mt-4 flex items-center justify-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: 'rgb(var(--text-muted))' }}>
              <ArrowRight className="w-4 h-4" /> العودة إلى تسجيل الدخول
            </button>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgb(var(--text-muted))' }}>
          AI Lead Hunter — منصة البحث الذكي عن العملاء
        </p>
      </div>
    </div>
  );
}
