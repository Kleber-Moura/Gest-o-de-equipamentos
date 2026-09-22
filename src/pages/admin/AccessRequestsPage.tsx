import { useEffect, useState } from 'react'
import { listAllProfiles, approveUser, rejectUser, blockUser, changeUserRole } from '@/services/profiles'
import { deleteUser } from '@/services/adminUsers'
import type { AppProfile, AppRole, ProfileStatus } from '@/types/auth'
import { StatusPill } from '@/components/StatusPill'
import { useAuth } from '@/hooks/useAuth'
import { useReferenceData } from '@/hooks/useReferenceData'
import { CreateUserModal } from '@/components/CreateUserModal'
import { EditUserModal } from '@/components/EditUserModal'
import { ResetPasswordModal } from '@/components/ResetPasswordModal'

const STATUS_LABEL: Record<ProfileStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  BLOCKED: 'Bloqueado',
}

function statusTone(status: ProfileStatus) {
  if (status === 'APPROVED') return 'ok'
  if (status === 'PENDING') return 'warn'
  return 'danger'
}

export function AccessRequestsPage() {
  const { profile: myProfile } = useAuth()
  const ref = useReferenceData()
  const [profiles, setProfiles] = useState<AppProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingProfile, setEditingProfile] = useState<AppProfile | null>(null)
  const [resettingProfile, setResettingProfile] = useState<AppProfile | null>(null)

  async function reload() {
    setLoading(true)
    try {
      setProfiles(await listAllProfiles())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar solicitações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id)
    setError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar ação')
    } finally {
      setBusyId(null)
    }
  }

  function handleDelete(p: AppProfile) {
    if (!window.confirm(`Excluir o usuário "${p.name}" (${p.email})? Essa ação não pode ser desfeita.`)) return
    run(p.id, () => deleteUser(p.id))
  }

  const pending = profiles.filter((p) => p.status === 'PENDING')
  const others = profiles.filter((p) => p.status !== 'PENDING')

  function renderRow(p: AppProfile) {
    const isSelf = p.id === myProfile?.id
    return (
      <tr key={p.id}>
        <td>{p.name}</td>
        <td>{p.email}</td>
        <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
        <td><StatusPill label={STATUS_LABEL[p.status]} tone={statusTone(p.status)} /></td>
        <td>
          <select
            value={p.role}
            disabled={isSelf || busyId === p.id}
            onChange={(e) => run(p.id, () => changeUserRole(p.id, e.target.value as AppRole))}
          >
            <option value="USER">Usuário</option>
            <option value="ADMIN">Administrador</option>
            <option value="MASTER">Master</option>
          </select>
        </td>
        <td>
          <div className="row-actions">
            {p.status === 'PENDING' && (
              <>
                <button className="button-small" disabled={busyId === p.id} onClick={() => run(p.id, () => approveUser(p.id))}>Aprovar</button>
                <button className="button-small button-danger" disabled={busyId === p.id} onClick={() => run(p.id, () => rejectUser(p.id))}>Rejeitar</button>
              </>
            )}
            {p.status === 'APPROVED' && !isSelf && (
              <button className="button-small button-danger" disabled={busyId === p.id} onClick={() => run(p.id, () => blockUser(p.id))}>Bloquear</button>
            )}
            {(p.status === 'BLOCKED' || p.status === 'REJECTED') && (
              <button className="button-small" disabled={busyId === p.id} onClick={() => run(p.id, () => approveUser(p.id))}>Reativar</button>
            )}
            <button className="button-small" disabled={busyId === p.id} onClick={() => setEditingProfile(p)}>Editar</button>
            <button className="button-small" disabled={busyId === p.id} onClick={() => setResettingProfile(p)}>Resetar senha</button>
            {!isSelf && (
              <button className="button-small button-danger" disabled={busyId === p.id} onClick={() => handleDelete(p)}>Excluir</button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>Solicitações de acesso</h2>
        <button className="button-primary" style={{ width: 'auto' }} onClick={() => setCreating(true)}>
          + Criar usuário
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Pendentes ({pending.length})</h3>
      <div className="data-table-wrapper" style={{ marginBottom: 28 }}>
        <table className="data-table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Solicitado em</th><th>Status</th><th>Perfil</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="empty-state">Carregando…</td></tr>}
            {!loading && pending.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhuma solicitação pendente</td></tr>}
            {!loading && pending.map(renderRow)}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Demais usuários</h3>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Solicitado em</th><th>Status</th><th>Perfil</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {!loading && others.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhum outro usuário</td></tr>}
            {!loading && others.map(renderRow)}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateUserModal
          departments={ref.departments}
          locations={ref.locations}
          onClose={() => setCreating(false)}
          onCreated={reload}
        />
      )}
      {editingProfile && (
        <EditUserModal
          profile={editingProfile}
          departments={ref.departments}
          locations={ref.locations}
          onClose={() => setEditingProfile(null)}
          onSaved={reload}
        />
      )}
      {resettingProfile && (
        <ResetPasswordModal profile={resettingProfile} onClose={() => setResettingProfile(null)} onDone={reload} />
      )}
    </div>
  )
}
