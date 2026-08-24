import { useEffect, useState } from 'react';
import { completeOAuthConnection } from '@/lib/services';
import { Loader2, ShieldCheck, XCircle } from 'lucide-react';

type Provider = 'linkedin' | 'facebook';

function providerFromPath(): Provider | null {
  const match = window.location.pathname.match(/^\/oauth\/(linkedin|facebook)\/callback\/?$/);
  return match?.[1] === 'linkedin' || match?.[1] === 'facebook' ? match[1] : null;
}

export function OAuthCallbackPage() {
  const [message, setMessage] = useState('جارٍ التحقق من الموافقة وإكمال الربط بأمان...');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const provider = providerFromPath();
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const providerLabel = provider === 'linkedin' ? 'LinkedIn' : 'Facebook';

    if (!provider || !code || !state) {
      setError(true);
      setMessage(params.get('error_description') ?? 'لم تكتمل موافقة OAuth أو أن الرابط غير صالح.');
      return () => { cancelled = true; };
    }

    completeOAuthConnection(provider, code, state)
      .then((result) => {
        if (cancelled) return;
        setMessage(`تم ربط حساب ${providerLabel} بنجاح${result.account_name ? `: ${result.account_name}` : ''}.`);
        window.history.replaceState({}, document.title, `/oauth/${provider}/callback`);
        window.setTimeout(() => { window.location.replace('/?oauth=success'); }, 900);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(true);
        setMessage(reason instanceof Error ? reason.message : 'تعذر إكمال ربط الحساب.');
        window.history.replaceState({}, document.title, `/oauth/${provider}/callback?oauth=error`);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'rgb(var(--bg-primary))' }}>
      <section className="w-full max-w-md rounded-2xl p-6 text-center space-y-4" style={{ background: 'rgb(var(--bg-secondary))' }}>
        {error ? <XCircle className="w-12 h-12 mx-auto" style={{ color: 'rgb(var(--danger))' }} /> : <ShieldCheck className="w-12 h-12 mx-auto" style={{ color: 'rgb(var(--accent))' }} />}
        {!error && <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'rgb(var(--accent))' }} />}
        <h1 className="text-lg font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{error ? 'تعذر إكمال الربط' : 'تأمين الاتصال'}</h1>
        <p className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{message}</p>
        {error && <button className="btn btn-secondary" onClick={() => window.location.replace('/?oauth=error')}>العودة إلى التطبيق</button>}
      </section>
    </main>
  );
}
