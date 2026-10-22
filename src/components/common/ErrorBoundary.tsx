import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-red-100 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {this.props.fallbackTitle || 'Ha ocurrido un problema inesperado'}
            </h2>
            
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              La aplicación encontró un error al cargar esta sección. Puedes recargar la página o volver a intentarlo de forma segura.
            </p>

            {this.state.error?.message && (
              <div className="w-full bg-slate-100 rounded-xl p-3 mb-6 text-left overflow-auto max-h-32">
                <code className="text-[11px] font-mono text-slate-700 break-words">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={14} /> Reintentar
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20"
              >
                <Home size={14} /> Recargar Portal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
