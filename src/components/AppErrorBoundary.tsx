import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Application error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section style={{ maxWidth: 520, textAlign: 'center' }}>
          <h1>حدث خطأ غير متوقع</h1>
          <p>لم تتأثر بياناتك. أعد تحميل التطبيق، وإذا استمر الخطأ جرّب تسجيل الدخول مرة أخرى.</p>
          <button onClick={() => window.location.reload()} style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, cursor: 'pointer' }}>
            إعادة تحميل التطبيق
          </button>
        </section>
      </main>
    );
  }
}
