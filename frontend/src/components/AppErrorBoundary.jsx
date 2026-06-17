import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined" && console.error) {
      console.error("App render error", error, info);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[var(--bg-base)] px-4 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center">
          <div className="card w-full overflow-hidden p-6 md:p-10">
            <div className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-rose-700">
              Frontend error
            </div>
            <h1 className="section-head mt-5">We hit a rendering problem</h1>
            <p className="muted mt-3 text-sm md:text-base">
              The app could not finish loading this screen. Refresh the page to try again, or go back to the home page.
            </p>
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm leading-6 text-rose-800">
              The screen failed to render correctly. Refresh the page to continue.
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
                Reload page
              </button>
              <a className="btn btn-ghost" href="/">
                Go home
              </a>
              <button className="btn btn-ghost" type="button" onClick={this.reset}>
                Try again
              </button>
            </div>
            {this.state.error?.stack && (
              <details className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm text-black/70">
                <summary className="cursor-pointer font-semibold text-black/70">Technical details</summary>
                {this.state.error?.message && (
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-black/40">
                    {String(this.state.error.message)}
                  </p>
                )}
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-black/60">
                  {String(this.state.error.stack)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }
}
