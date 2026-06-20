import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  fallback?: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error('ErrorBoundary caught an error', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-center px-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Noget gik galt</h2>
            <p className="text-sm text-slate-600 mb-4">
              Vi kunne ikke hente indholdet. Tjek din forbindelse og prøv igen.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-cta text-text-inverse rounded-lg hover:bg-cta-hover transition-colors text-sm font-medium"
            >
              Prøv igen
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
