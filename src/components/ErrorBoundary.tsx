'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
      window.location.reload()
      return { hasError: false, message: '' }
    }
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center p-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Algo correu mal</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ocorreu um erro inesperado nesta página.
            </p>
          </div>
          <Button onClick={() => this.setState({ hasError: false, message: '' })} variant="outline">
            Tentar novamente
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
