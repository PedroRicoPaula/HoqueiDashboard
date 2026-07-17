'use client'

import { useEffect, useState } from 'react'

// SSR e o primeiro render no cliente têm de produzir o mesmo HTML (hidratação).
// Estado vindo de stores persistidas (localStorage) só está disponível depois de montar,
// por isso qualquer JSX cuja estrutura (não só texto) dependa desse estado deve esperar
// por `mounted` antes de o usar — caso contrário o React lança erro de hidratação (#418).
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
