import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.name || 'ErrorBoundary'}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-12 text-center bg-[var(--color-primary-bg)] rounded-[var(--radius-md)] border-[var(--color-border-secondary)] border-dashed border-[var(--color-border-secondary)]">
          <div className="w-20 h-20 bg-rose-500/10 rounded-[var(--radius-md)] flex items-center justify-center text-rose-500 mb-8">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-[var(--text-xl)] font-display font-bold text-white mb-4">Something went wrong.</h2>
          <p className="text-[var(--text-lg)] text-[#86868B] max-w-[400px] mb-10 leading-relaxed font-medium">
            The {this.props.name || 'component'} encountered an unexpected error. This has been logged for our engineers.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={this.handleReset}
              className="px-8 py-4 bg-[#1D1D1F] text-white rounded-full font-semibold uppercase tracking-[0.2em] text-[var(--text-sm)] flex items-center gap-3 hover:scale-[1.02] transition-all active:scale-95 shadow-xl shadow-black/10"
            >
              <RefreshCw size={18} />
              Reboot View
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-4 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] text-white rounded-full font-semibold uppercase tracking-[0.2em] text-[var(--text-sm)] flex items-center gap-3 hover:bg-[var(--color-background-tertiary)] transition-all active:scale-95"
            >
              <Home size={18} />
              Return Home
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-12 p-6 bg-[var(--color-card-bg)] border border-[var(--color-border-secondary)] rounded-[var(--radius-md)] text-left max-w-full overflow-auto shadow-sm">
              <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[#86868B] mb-2">Technical Details</p>
              <pre className="text-[var(--text-sm)] font-mono text-rose-600 whitespace-pre-wrap">
                {this.state.error.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
