// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { trackError } from '@/lib/tracker';

/* If a screen crashes, the rest of the app keeps running: the error is logged
   to the tracker and the user gets a calm way back instead of a white page. */

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const withStack = new Error(error.message);
    withStack.stack = `${error.stack ?? ''}\n\nComponent stack:${info.componentStack ?? ''}`;
    void trackError(withStack, 'react');
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center"
      >
        <div
          className="mb-5 grid size-16 place-items-center rounded-[22px] bg-bad/12 text-3xl"
          aria-hidden
        >
          🧯
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">صار خلل في هالشاشة</h1>
        <p className="mt-2 text-sm leading-6 text-ink-3">
          بياناتك بأمان، وسجّلنا الخطأ في «التشخيص» داخل الإعدادات. الرجوع والإكمال عادي.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="h-11 rounded-[14px] bg-accent-gradient-strong px-5 font-semibold text-white"
          >
            إعادة المحاولة
          </button>
          <a
            href="#/"
            className="grid h-11 place-items-center rounded-[14px] border border-line px-5 font-semibold text-ink"
          >
            الرئيسية
          </a>
        </div>
      </div>
    );
  }
}
