import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Evita que alguém já logado veja de novo a tela de login/cadastro. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  return <>{children}</>
}
