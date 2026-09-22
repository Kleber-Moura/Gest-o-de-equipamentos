import { useEffect, useState } from 'react'
import { listAuditLogs, listActorNames } from '@/services/auditLogs'
import type { AuditLog } from '@/types/domain'

const PAGE_SIZE = 30

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  ASSIGN: 'Atribuição',
  UNASSIGN: 'Desvinculação',
  DEACTIVATE: 'Desativação',
  REACTIVATE: 'Reativação',
  APPROVE_USER: 'Aprovação de usuário',
  REACTIVATE_USER: 'Reativação de usuário',
  REJECT_USER: 'Rejeição de usuário',
  BLOCK_USER: 'Bloqueio de usuário',
  CHANGE_ROLE: 'Alteração de perfil',
  CREATE_USER: 'Criação de usuário',
  UPDATE_PROFILE: 'Edição de usuário',
  RESET_PASSWORD: 'Reset de senha',
  DELETE_USER: 'Exclusão de usuário',
  PROCESS_INVOICE: 'Leitura de fatura (IA)',
}

const ENTITY_LABEL: Record<string, string> = {
  notebooks: 'Notebook',
  accessories: 'Acessório',
  phone_lines: 'Linha telefônica',
  employees: 'Colaborador',
  app_profiles: 'Usuário do sistema',
  invoice_uploads: 'Fatura enviada',
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map())
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([listAuditLogs(page, PAGE_SIZE), listActorNames()])
      .then(([logsResult, names]) => {
        setLogs(logsResult.data)
        setCount(logsResult.count)
        setActorNames(names)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar auditoria'))
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <div className="page-header">
        <h2>Histórico de auditoria</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Quando</th><th>Quem</th><th>Entidade</th><th>Ação</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="empty-state">Carregando…</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={4} className="empty-state">Sem registros</td></tr>}
            {!loading && logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                <td>{log.actor_user_id ? actorNames.get(log.actor_user_id) ?? '—' : 'Sistema / usuário removido'}</td>
                <td>{ENTITY_LABEL[log.entity_type] ?? log.entity_type}</td>
                <td>{ACTION_LABEL[log.action] ?? log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span>{count} registro(s) — página {page + 1} de {totalPages}</span>
          <button className="button-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <button className="button-secondary" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</button>
        </div>
      </div>
    </div>
  )
}
