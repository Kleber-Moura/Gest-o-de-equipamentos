import { useEffect, useState } from 'react'
import { listNotebooks, setNotebookDeactivated, assignNotebook, unassignNotebook } from '@/services/notebooks'
import type { NotebookFilters } from '@/services/notebooks'
import type { NotebookWithLifecycle } from '@/types/domain'
import { NOTEBOOK_STATUS_LABEL, LIFECYCLE_LABEL } from '@/types/domain'
import { useReferenceData } from '@/hooks/useReferenceData'
import { useAuth } from '@/hooks/useAuth'
import { StatusPill } from '@/components/StatusPill'
import { NotebookFormModal } from '@/components/NotebookFormModal'
import { AssignEmployeeModal } from '@/components/AssignEmployeeModal'
import { lifecycleFriendlyText } from '@/utils/lifecycleText'

const PAGE_SIZE = 15

function lifecycleTone(status: string) {
  if (status === 'TROCAR') return 'danger'
  if (status === 'ATENCAO') return 'warn'
  return 'ok'
}

function statusTone(status: string) {
  if (status === 'ASSIGNED') return 'ok'
  if (status === 'BROKEN') return 'danger'
  if (status === 'AVAILABLE') return 'neutral'
  return 'warn'
}

export function NotebooksPage() {
  const ref = useReferenceData()
  const { profile } = useAuth()
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'MASTER'

  const [filters, setFilters] = useState<NotebookFilters>({ page: 0 })
  const [rows, setRows] = useState<NotebookWithLifecycle[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<NotebookWithLifecycle | 'new' | null>(null)
  const [assigning, setAssigning] = useState<NotebookWithLifecycle | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const result = await listNotebooks({ ...filters, pageSize: PAGE_SIZE })
      setRows(result.data)
      setCount(result.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar notebooks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function handleDeactivate(notebook: NotebookWithLifecycle) {
    await setNotebookDeactivated(notebook.id, true)
    reload()
  }

  async function handleUnassign(notebook: NotebookWithLifecycle) {
    await unassignNotebook(notebook.id)
    reload()
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const page = filters.page ?? 0

  function togglePatrimonioSort() {
    setFilters((f) => ({ ...f, sortDir: f.sortDir === 'desc' ? 'asc' : 'desc', page: 0 }))
  }

  return (
    <div>
      <div className="page-header">
        <h2>Notebooks</h2>
        {canManage && (
          <button className="button-primary" style={{ width: 'auto' }} onClick={() => setEditing('new')}>
            + Novo notebook
          </button>
        )}
      </div>

      <div className="filters-bar">
        <input
          placeholder="Buscar por patrimônio, serial, modelo ou responsável…"
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 0 }))}
        />
        <select onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as never, page: 0 }))}>
          <option value="">Todos os status</option>
          {Object.entries(NOTEBOOK_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, lifecycleStatus: (e.target.value || undefined) as never, page: 0 }))}>
          <option value="">Ciclo de vida (todos)</option>
          {Object.entries(LIFECYCLE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, locationId: e.target.value || undefined, page: 0 }))}>
          <option value="">Todas as localidades</option>
          {ref.locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value || undefined, page: 0 }))}>
          <option value="">Todos os departamentos</option>
          {ref.departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={togglePatrimonioSort}>
                Patrimônio
                {filters.sortDir && <span className="sort-indicator">{filters.sortDir === 'desc' ? '▼' : '▲'}</span>}
              </th>
              <th>Modelo</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Localidade</th>
              <th>Ciclo de vida</th>
              {canManage && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="empty-state">Carregando…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="empty-state">Nenhum notebook encontrado</td></tr>
            )}
            {!loading && rows.map((n) => (
              <tr key={n.id}>
                <td>{n.patrimonio}</td>
                <td>{n.modelo}</td>
                <td><StatusPill label={NOTEBOOK_STATUS_LABEL[n.status]} tone={statusTone(n.status)} /></td>
                <td>{ref.employeeName(n.employee_id)}</td>
                <td>{ref.locationName(n.location_id)}</td>
                <td>
                  <StatusPill label={lifecycleFriendlyText(n.data_prevista_troca)} tone={lifecycleTone(n.lifecycle_status)} />
                </td>
                {canManage && (
                  <td>
                    <div className="row-actions">
                      <button className="button-small" onClick={() => setEditing(n)}>Editar</button>
                      {n.employee_id ? (
                        <button className="button-small" onClick={() => handleUnassign(n)}>Desvincular</button>
                      ) : (
                        <button className="button-small" onClick={() => setAssigning(n)}>Atribuir</button>
                      )}
                      <button className="button-small button-danger" onClick={() => handleDeactivate(n)}>Desativar</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span>{count} notebook(s) — página {page + 1} de {totalPages}</span>
          <button className="button-secondary" disabled={page === 0} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>Anterior</button>
          <button className="button-secondary" disabled={page + 1 >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>Próxima</button>
        </div>
      </div>

      {editing && (
        <NotebookFormModal
          notebook={editing === 'new' ? undefined : editing}
          locations={ref.locations}
          employees={ref.employees}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {assigning && (
        <AssignEmployeeModal
          employees={ref.employees}
          onConfirm={(employeeId, notes) => assignNotebook(assigning.id, employeeId, notes).then(reload)}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  )
}
