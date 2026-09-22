import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/layouts/AppLayout'
import { AccountStatusPage } from '@/pages/AccountStatusPage'

/** Único ponto que decide o que um usuário autenticado pode ver, com base em
 * app_profiles.status — a mesma regra que a RLS já garante no banco (item 28
 * do briefing: PENDING não acessa nada funcional), aqui só para dar feedback na UI. */
export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="centered-state">
        <p>Carregando…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="centered-state">
        <p>Preparando seu perfil…</p>
      </div>
    )
  }

  if (profile.status !== 'APPROVED') {
    return <AccountStatusPage status={profile.status} />
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
