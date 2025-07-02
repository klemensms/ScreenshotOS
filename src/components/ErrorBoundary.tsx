import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🔥 [ERROR_BOUNDARY] Error caught by boundary:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const boundaryName = this.props.name || 'Unknown';
    console.error(`🔥 [ERROR_BOUNDARY] ${boundaryName} - Component crashed:`, error);
    console.error(`🔥 [ERROR_BOUNDARY] ${boundaryName} - Error info:`, errorInfo);
    console.error(`🔥 [ERROR_BOUNDARY] ${boundaryName} - Component stack:`, errorInfo.componentStack);
    
    this.setState({ 
      hasError: true, 
      error, 
      errorInfo 
    });

    // Log to main process for debugging
    if (window.electron && window.electron.logFromRenderer) {
      window.electron.logFromRenderer(
        'error',
        `React Error Boundary: ${boundaryName}`,
        error,
        {
          componentStack: errorInfo.componentStack,
          errorBoundary: boundaryName
        }
      ).catch(console.error);
    }
  }

  render() {
    if (this.state.hasError) {
      const boundaryName = this.props.name || 'Component';
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          margin: '10px',
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#ffe0e0',
          color: '#d63031'
        }}>
          <h3>🔥 {boundaryName} Error</h3>
          <p>Something went wrong in this component.</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Error Details (click to expand)</summary>
            <pre style={{ 
              fontSize: '12px', 
              overflow: 'auto', 
              maxHeight: '200px',
              backgroundColor: '#fff',
              padding: '10px',
              margin: '10px 0'
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#00b894',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryName?: string,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary name={boundaryName} fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}