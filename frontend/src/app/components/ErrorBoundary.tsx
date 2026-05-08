import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            
            <h1 className="mt-4 text-xl font-semibold text-center text-gray-900">
              Something went wrong
            </h1>
            
            <p className="mt-2 text-sm text-center text-gray-600">
              We're sorry for the inconvenience. Please try reloading the page.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-40">
                <p className="text-red-600 font-semibold">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <pre className="mt-2 text-gray-700 whitespace-pre-wrap text-xs">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            
            <div className="mt-6 flex gap-3">
              <Button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2"
                variant="default"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Button>
              <Button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
            </div>
            
            <p className="mt-4 text-xs text-center text-gray-500">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
