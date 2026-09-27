import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#211f1e] p-6 text-[#f5efe4]">
      <div className="max-w-lg w-full rounded-sm border border-[#484039] bg-[#292624] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 h-2 w-12 bg-[#d49a52]" />
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#d49a52]">
          CHOW 'N' VIBES · RECOVERY
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          This service needs a reset
        </h1>
        <p className="mt-2 text-sm text-[#a49b8f]">
          The ordering screen hit an unexpected error. Your database records are unchanged.
        </p>
        {/* Temporarily shown in all environments for debugging. Revert to DEV-only once fixed. */}
        <pre className="mt-4 overflow-x-auto rounded-sm border border-[#484039] bg-[#181716] p-3 text-left text-xs text-[#d8d3c8]">
          {error.message || String(error)}
        </pre>
        <button
          type="button"
          onClick={resetError}
          className="mt-5 rounded-sm bg-[#d49a52] px-5 py-3 text-sm font-semibold text-[#211f1e] hover:bg-[#e8bd79]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
