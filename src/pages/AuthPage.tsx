// ============================================================
// Auth Page — Sign in / Sign up / Password recovery
// ============================================================

import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery';

interface AuthPageProps {
  recovery?: boolean;
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Mail;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold" style={{ color: 'rgb(var(--text-secondary))' }}>
        {label}
      </span>
      <span className="relative block">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2"
          style={{ color: 'rgb(var(--text-muted))' }}
        />
        {children}
      </span>
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} icon={Lock}>
      <input
        type={visible ? 'text' : 'password'}
        className="input h-12 rounded-2xl border-0 pl-12 pr-12 text-sm shadow-none"
        style={{ background: 'rgb(var(--bg-secondary))' }}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        minLength={6}
      />
      <button
        type="button"
        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        onClick={() => setVisible((current) => !current)}
        className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        style={{ color: 'rgb(var(--text-muted))' }}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </Field>
  );
}

const BENEFITS = [
  { icon: Radar, text: 'اكتشاف العملاء المحتملين من مصادر متعددة' },
  { icon: Sparkles, text: 'تحليل ذكي وترتيب العملاء حسب الأولوية' },
  { icon: ShieldCheck, text: 'بياناتك ومفاتيحك محفوظة بأمان' },
];

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
  const isSignUp = mode === 'signup';

  return (
    <main
      className="relative flex min-h-[100dvh] items-center overflow-hidden px-4 py-6 sm:px-6 lg:px-8"
      style={{ background: 'rgb(var(--bg-primary))' }}
    >
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full blur-3xl" style={{ background: 'rgb(var(--accent) / 0.10)' }} />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full blur-3xl" style={{ background: 'rgb(var(--accent) / 0.08)' }} />

      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border shadow-2xl lg:min-h-[680px] lg:grid-cols-[1.05fr_0.95fr]" style={{ background: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border))', boxShadow: '0 24px 80px rgb(2 8 23 / 0.16)' }}>
        <section
          className="relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14"
          style={{ background: 'linear-gradient(145deg, #071a31 0%, #0b2c4d 55%, #075985 100%)' }}
        >
          <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full border border-cyan-300/10" />
          <div className="pointer-events-none absolute -left-16 top-36 h-40 w-40 rounded-full border border-cyan-300/10" />
          <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />

          <div className="relative">
            <div className="mb-12 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
                <img src="/icons/app-icon-192.png" alt="" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">AI Lead Hunter</p>
                <p className="text-xs text-cyan-100/65">منصة النمو الذكي</p>
              </div>
            </div>

            <div className="max-w-md">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                <Zap className="h-3.5 w-3.5" />
                ابحث بذكاء، وانمُ أسرع
              </div>
              <h1 className="text-4xl font-black leading-[1.22] tracking-tight xl:text-5xl">
                كل عميل محتمل يستحق فرصة أفضل.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-8 text-slate-200/75">
                اجمع فرص النمو من مكان واحد، ودع الذكاء الاصطناعي يساعدك على اكتشاف العملاء الأكثر قيمة وترتيبهم.
              </p>
            </div>

            <div className="mt-10 space-y-4">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-slate-100/85">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-3 text-xs text-slate-300/60">
            <span className="h-px w-10 bg-white/20" />
            مصمم لفرق المبيعات الحديثة
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 overflow-hidden rounded-xl">
                  <img src="/icons/app-icon-192.png" alt="AI Lead Hunter" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: 'rgb(var(--text-primary))' }}>AI Lead Hunter</p>
                  <p className="text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>منصة النمو الذكي</p>
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                <Radar className="h-4 w-4" />
              </div>
            </div>

            <div className="mb-8">
              {isRecovery ? (
                <>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>أنشئ كلمة مرور جديدة</h2>
                  <p className="mt-2 text-sm leading-7" style={{ color: 'rgb(var(--text-muted))' }}>اختر كلمة مرور قوية لحماية حسابك ومعلومات عملائك.</p>
                </>
              ) : isForgot ? (
                <>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>استعادة الوصول</h2>
                  <p className="mt-2 text-sm leading-7" style={{ color: 'rgb(var(--text-muted))' }}>أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً للعودة إلى حسابك.</p>
                </>
              ) : (
                <>
                  <div className="mb-5 flex items-center gap-2 text-xs font-semibold" style={{ color: 'rgb(var(--accent))' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgb(var(--accent))' }} />
                    مساحة عملك الذكية تبدأ من هنا
                  </div>
                  <h2 className="text-3xl font-black tracking-tight" style={{ color: 'rgb(var(--text-primary))' }}>
                    {isSignUp ? 'ابدأ رحلتك مع العملاء' : 'مرحباً بعودتك'}
                  </h2>
                  <p className="mt-2 text-sm leading-7" style={{ color: 'rgb(var(--text-muted))' }}>
                    {isSignUp ? 'أنشئ حسابك وابدأ بتحويل البيانات إلى فرص نمو.' : 'سجّل الدخول للوصول إلى لوحة العملاء وفرصك الجديدة.'}
                  </p>
                </>
              )}
            </div>

            {!isRecovery && !isForgot && (
              <div className="mb-7 grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'rgb(var(--bg-secondary))' }}>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="rounded-xl py-2.5 text-sm font-bold transition-all"
                  style={mode === 'signin' ? { background: 'rgb(var(--bg-card))', color: 'rgb(var(--text-primary))', boxShadow: 'var(--shadow-md)' } : { color: 'rgb(var(--text-muted))' }}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="rounded-xl py-2.5 text-sm font-bold transition-all"
                  style={mode === 'signup' ? { background: 'rgb(var(--bg-card))', color: 'rgb(var(--text-primary))', boxShadow: 'var(--shadow-md)' } : { color: 'rgb(var(--text-muted))' }}
                >
                  حساب جديد
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <Field label="الاسم الكامل" icon={User}>
                  <input
                    type="text"
                    className="input h-12 rounded-2xl border-0 pr-12 text-sm shadow-none"
                    style={{ background: 'rgb(var(--bg-secondary))' }}
                    placeholder="محمد أحمد"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </Field>
              )}

              {!isRecovery && (
                <Field label="البريد الإلكتروني" icon={Mail}>
                  <input
                    type="email"
                    className="input h-12 rounded-2xl border-0 pr-12 text-sm shadow-none"
                    style={{ background: 'rgb(var(--bg-secondary))' }}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    dir="ltr"
                    required
                  />
                </Field>
              )}

              {mode !== 'forgot' && (
                <PasswordField
                  label={isRecovery ? 'كلمة المرور الجديدة' : 'كلمة المرور'}
                  value={password}
                  onChange={setPassword}
                  autoComplete={isRecovery ? 'new-password' : mode === 'signin' ? 'current-password' : 'new-password'}
                />
              )}

              {isRecovery && (
                <PasswordField
                  label="تأكيد كلمة المرور الجديدة"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                />
              )}

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-2xl p-3.5 text-sm leading-6" style={{ background: 'rgb(var(--danger-soft))', color: 'rgb(var(--danger))' }}>
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'currentColor' }} />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" loading={loading} className="h-12 w-full rounded-2xl text-sm shadow-lg" style={{ boxShadow: '0 10px 24px rgb(var(--accent) / 0.22)' }}>
                {isRecovery ? 'حفظ كلمة المرور الجديدة' : isForgot ? 'إرسال رابط الاستعادة' : mode === 'signin' ? 'دخول إلى مساحة العمل' : 'إنشاء حساب مجاني'}
                {!loading && <ArrowLeft className="h-4 w-4" />}
              </Button>
            </form>

            {mode === 'signin' && (
              <button type="button" onClick={() => switchMode('forgot')} className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm font-bold transition-opacity hover:opacity-75" style={{ color: 'rgb(var(--accent))' }}>
                نسيت كلمة المرور؟
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}

            {(isForgot || isRecovery) && (
              <button type="button" onClick={() => switchMode('signin')} className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-bold transition-opacity hover:opacity-75" style={{ color: 'rgb(var(--text-muted))' }}>
                <ArrowRight className="h-4 w-4" />
                العودة إلى تسجيل الدخول
              </button>
            )}

            {!isRecovery && !isForgot && (
              <div className="mt-8 flex items-center justify-center gap-2 text-center text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>
                <Users className="h-3.5 w-3.5" />
                مساحة آمنة لفريقك وبياناتك
                <Check className="h-3.5 w-3.5" style={{ color: 'rgb(var(--success))' }} />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
