import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { getUserFriendlyErrorMessage } from '@/lib/retry-utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKeys?: Array<string | number>;
  resetMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetKeys: Array<string | number>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
    this.resetKeys = props.resetKeys || [];
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetKeys !== resetKeys) {
      const hasResetKeyChanged = resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx]);
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Track error count to suggest page refresh after multiple errors
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));

    // Log to external error tracking service if available
    if (typeof window !== 'undefined' && (window as any).trackError) {
      (window as any).trackError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  handleReset = () => {
    this.resetErrorBoundary();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      const errorInfo = getUserFriendlyErrorMessage(this.state.error || new Error('Unknown error'));

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-red-900">
                    {errorInfo.title}
                  </h3>
                  <p className="mt-2 text-sm text-red-700">
                    {errorInfo.description}
                  </p>
                  {errorInfo.action && (
                    <p className="mt-2 text-sm text-gray-600">
                      {errorInfo.action}
                    </p>
                  )}
                  
                  {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                    <details className="mt-4">
                      <summary className="text-sm text-red-600 cursor-pointer">
                        Error details
                      </summary>
                      <pre className="mt-2 text-xs text-red-600 overflow-auto bg-red-50 p-2 rounded">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                  
                  <div className="mt-6 flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={this.handleReset}
                      variant="outline"
                      size="sm"
                      className="text-red-700 border-red-300 hover:bg-red-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {this.props.resetMessage || 'Try again'}
                    </Button>
                    
                    {this.state.errorCount > 2 && (
                      <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        size="sm"
                        className="text-gray-700 border-gray-300 hover:bg-gray-100"
                      >
                        Refresh Page
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => window.location.href = '/'}
                      variant="outline"
                      size="sm"
                      className="text-gray-700 border-gray-300 hover:bg-gray-100"
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Go Home
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}