'use client';

import { Component, type ReactNode } from 'react';

interface SimulationErrorBoundaryProps {
  children: ReactNode;
  onSimulationError?: () => void;
}

interface SimulationErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specialise pour la zone de simulation.
 * En cas d'erreur, affiche un message et propose de reinitialiser.
 */
export class SimulationErrorBoundary extends Component<
  SimulationErrorBoundaryProps,
  SimulationErrorBoundaryState
> {
  constructor(props: SimulationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SimulationErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[SimulationErrorBoundary]', error, errorInfo);
    this.props.onSimulationError?.();
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
          <div className="border border-destructive/30 bg-destructive/5 p-6 max-w-md text-center space-y-4" style={{ borderRadius: '3px' }}>
            <div className="font-mono text-[10px] text-destructive uppercase tracking-wider">
              Erreur de simulation
            </div>
            <p className="text-sm text-muted-foreground">
              Une erreur est survenue dans le moteur de simulation ou le canvas.
              L&apos;etat de votre architecture a ete preserve.
            </p>
            {this.state.error && (
              <pre className="text-[11px] text-destructive/80 bg-destructive/10 p-3 overflow-auto text-left" style={{ borderRadius: '2px' }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="font-mono text-xs px-6 py-2 bg-foreground text-background hover:opacity-80 transition-opacity"
              style={{ borderRadius: '2px' }}
            >
              Reinitialiser la simulation
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
