/** Catches an error thrown while rendering a page or running its effects, so the page shows a short
 *  notice with a way out instead of the whole app unmounting to a blank screen. The top bar stays outside
 *  it, so the other pages and the account switcher keep working.
 *
 *  It stays mounted across page changes and clears itself when `resetKey` (the page) changes. A keyed
 *  boundary would be torn down with the old page, and an error from that page's cleanup would then find
 *  no boundary at all. */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./primitives";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(previous: { resetKey?: string }) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LouNgak AI: a page failed and was replaced by an error notice.", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="flex h-full items-center justify-center bg-sunken p-6">
        <div className="max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-5 text-center shadow-[var(--shadow-md)]">
          <TriangleAlert className="mx-auto h-6 w-6 text-warn" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="mt-2 text-[15px] font-semibold text-ink">This page stopped working</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Something went wrong while showing it. Your data is safe; the other pages still work from the top bar.
          </p>
          <p className="mt-2 font-mono text-[11px] break-words text-faint">{error.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button variant="primary" onClick={() => window.location.reload()}>Reload the app</Button>
          </div>
        </div>
      </div>
    );
  }
}
