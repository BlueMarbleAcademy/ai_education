import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an external service here
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-3xl mx-auto p-8">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-4">An unexpected error occurred while rendering this page. Details are shown below for debugging.</p>
          <div className="bg-white p-4 rounded shadow-sm overflow-auto">
            <pre className="text-xs text-red-700 whitespace-pre-wrap">{String(this.state.error)}</pre>
            {this.state.errorInfo && (
              <details className="mt-2 text-xs text-gray-700">
                <summary className="cursor-pointer">Stack trace</summary>
                <pre className="text-xs whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
