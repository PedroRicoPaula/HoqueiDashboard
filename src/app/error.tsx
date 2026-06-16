'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production, send to monitoring service here
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8 bg-gray-50">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Erro inesperado</h1>
        <p className="text-muted-foreground mt-2">
          Ocorreu um erro. Por favor tente novamente.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Voltar ao início
        </Button>
      </div>
    </div>
  )
}
