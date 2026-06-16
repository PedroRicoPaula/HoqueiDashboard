import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8 bg-gray-50">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <div>
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <p className="text-lg text-muted-foreground mt-2">Página não encontrada</p>
        <p className="text-sm text-muted-foreground mt-1">
          A página que procura não existe ou foi movida.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Voltar ao Dashboard</Link>
      </Button>
    </div>
  )
}
