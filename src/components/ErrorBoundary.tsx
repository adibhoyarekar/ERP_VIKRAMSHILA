import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    (this as any).setState({ hasError: false, error: null });
  };

  public render() {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;

    if (state.hasError) {
      const isChunkError =
        state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        state.error?.message?.includes('Importing a module script failed') ||
        state.error?.message?.includes('error loading dynamically imported module');

      return (
        <div className="min-h-[300px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-sm border border-rose-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isChunkError ? 'New ERP Version Available' : (props.fallbackTitle || 'Something went wrong')}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {isChunkError
                  ? 'A new update was deployed to Vikramshila College ERP. Click below to load the latest version.'
                  : (state.error?.message || 'An unexpected error occurred while displaying this section.')}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                {isChunkError ? 'Update & Refresh' : 'Reload Page'}
              </button>
              {!isChunkError && (
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return props.children;
  }
}
