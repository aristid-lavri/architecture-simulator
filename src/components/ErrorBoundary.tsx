'use client';

import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary generique reutilisable.
 * Capture les erreurs de rendu React et affiche un fallback user-friendly.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 gap-4 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Erreur inattendue
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Une erreur est survenue dans ce composant. Vous pouvez essayer de le recharger.
          </p>
          {this.state.error && (
            <pre className="text-[11px] text-destructive bg-destructive/10 p-3 rounded max-w-md overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="text-xs font-mono px-4 py-2 border border-border hover:bg-accent transition-colors"
            style={{ borderRadius: '2px' }}
          >
            Recharger
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
