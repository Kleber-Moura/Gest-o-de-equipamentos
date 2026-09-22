import { useAuth } from '@/hooks/useAuth'
import type { ProfileStatus } from '@/types/auth'

const MESSAGES: Record<Exclude<ProfileStatus, 'APPROVED'>, { title: string; body: string; tone: 'warning' | 'error' }> = {
  PENDING: {
    title: 'Cadastro pendente de aprovação',
    body: 'Sua solicitação de acesso foi recebida e está aguardando aprovação de um administrador (MASTER). Você será notificado quando seu acesso for liberado.',
    tone: 'warning',
  },
  REJECTED: {
    title: 'Solicitação de acesso rejeitada',
    body: 'Sua solicitação de acesso não foi aprovada. Entre em contato com a equipe de TI se acredita que isso é um engano.',
    tone: 'error',
  },
  BLOCKED: {
    title: 'Acesso bloqueado',
    body: 'Sua conta foi bloqueada por um administrador. Entre em contato com a equipe de TI para mais informações.',
    tone: 'error',
  },
}

export function AccountStatusPage({ status }: { status: Exclude<ProfileStatus, 'APPROVED'> }) {
  const { signOut, profile } = useAuth()
  const message = MESSAGES[status]

  return (
    <div className="centered-state">
      <div className="centered-state-card">
        <div className={`alert alert-${message.tone}`} style={{ textAlign: 'center' }}>
          {message.title}
        </div>
        <p style={{ marginTop: 16, marginBottom: 8 }}>{message.body}</p>
        {profile && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Conta: {profile.email}</p>}
        <button className="button-link" style={{ marginTop: 16 }} onClick={() => signOut()}>
          Sair
        </button>
      </div>
    </div>
  )
}
