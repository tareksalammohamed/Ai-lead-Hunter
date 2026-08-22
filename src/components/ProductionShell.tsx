import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Download, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function ProductionShell({ children }: { children: React.ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [dismissedInstall, setDismissedInstall] = useState(false);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url: string, registration?: ServiceWorkerRegistration) {
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    (async () => {
      await StatusBar.setBackgroundColor({ color: '#081B33' });
      await StatusBar.setStyle({ style: Style.Dark });
      await SplashScreen.hide();
      handle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack && window.history.length > 1) window.history.back();
        else CapacitorApp.exitApp();
      });
    })();
    return () => { handle?.remove(); };
  }, []);

  useEffect(() => {
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <div className="production-shell">
      {!online && <div className="fixed top-0 inset-x-0 z-[100] bg-amber-600 text-white text-center text-xs py-2 safe-top"><WifiOff className="inline w-3.5 h-3.5 ml-1" /> غير متصل — عمليات AI والبحث والكتابة تحتاج إلى الإنترنت.</div>}
      {online && <div className="sr-only"><Wifi aria-label="متصل بالإنترنت" /></div>}
      {installEvent && !isStandalone && !dismissedInstall && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[90] rounded-2xl p-4 shadow-2xl border" style={{ background: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border))' }}>
          <button aria-label="إغلاق" onClick={() => setDismissedInstall(true)} className="absolute top-2 left-2 p-1"><X className="w-4 h-4" /></button>
          <div className="flex items-center gap-3"><img src="/icons/app-icon-72.png" alt="AI Lead Hunter" className="w-12 h-12 rounded-xl" /><div className="flex-1"><p className="font-bold">ثبّت AI Lead Hunter</p><p className="text-xs opacity-70">استخدمه كتطبيق مستقل على جهازك.</p></div></div>
          <Button className="w-full mt-3" onClick={install}><Download className="w-4 h-4" /> تثبيت التطبيق</Button>
        </div>
      )}
      {needRefresh && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[90] rounded-2xl p-4 shadow-2xl border" style={{ background: 'rgb(var(--bg-primary))', borderColor: 'rgb(var(--border))' }}>
          <p className="font-bold">يتوفر إصدار جديد من AI Lead Hunter.</p><p className="text-xs opacity-70 mt-1">حدّث التطبيق بأمان دون فقدان الجلسة.</p>
          <div className="flex gap-2 mt-3"><Button onClick={() => updateServiceWorker(true)}><RefreshCw className="w-4 h-4" /> تحديث الآن</Button><Button variant="secondary" onClick={() => window.location.reload()}>لاحقاً</Button></div>
        </div>
      )}
      {children}
    </div>
  );
}
