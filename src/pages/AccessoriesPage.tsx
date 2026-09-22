import { useEffect, useState } from 'react'
import { listAccessories, setAccessoryDeactivated, assignAccessory, unassignAccessory } from '@/services/accessories'
import type { AccessoryFilters } from '@/services/accessories'
import type { Accessory } from '@/types/domain'
import { ACCESSORY_STATUS_LABEL } from '@/types/domain'
import { useReferenceData } from '@/hooks/useReferenceData'
import { useAuth } from '@/hooks/useAuth'
import { StatusPill } from '@/components/StatusPill'
import { AccessoryFormModal } from '@/components/AccessoryFormModal'
import { AssignEmployeeModal } from '@/components/AssignEmployeeModal'

const PAGE_SIZE = 15

function statusTone(status: string) {
  if (status === 'ASSIGNED') return 'ok'
  if (status === 'BROKEN' || status === 'DECOMMISSIONED') return 'danger'
  if (status === 'AVAILABLE') return 'neutral'
  return 'warn'
}

export function AccessoriesPage() {
  const ref = useReferenceData()
  const { profile } = useAuth()
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'MASTER'

  const [filters, setFilters] = useState<AccessoryFilters>({ page: 0 })
  const [rows, setRows] = useState<Accessory[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Accessory | 'new' | null>(null)
  const [assigning, setAssigning] = useState<Accessory | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const result = await listAccessories({ ...filters, pageSize: PAGE_SIZE })
      setRows(result.data)
      setCount(result.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar acessórios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const page = filters.page ?? 0

  function togglePatrimonioSort() {
    setFilters((f) => ({ ...f, sortDir: f.sortDir === 'desc' ? 'asc' : 'desc', page: 0 }))
  }

  return (
    <div>
      <div className="page-header">
        <h2>Acessórios</h2>
        {canManage && (
          <button className="button-primary" style={{ width: 'auto' }} onClick={() => setEditing('new')}>
            + Novo acessório
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
          {Object.entries(ACCESSORY_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value || undefined, page: 0 }))}>
          <option value="">Todas as categorias</option>
          {ref.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, locationId: e.target.value || undefined, page: 0 }))}>
          <option value="">Todas as localidades</option>
          {ref.locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Categoria</th>
              <th className="sortable" onClick={togglePatrimonioSort}>
                Patrimônio
                {filters.sortDir && <span className="sort-indicator">{filters.sortDir === 'desc' ? '▼' : '▲'}</span>}
              </th>
              <th>Serial</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Localidade</th>
              {canManage && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="empty-state">Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="empty-state">Nenhum acessório encontrado</td></tr>}
            {!loading && rows.map((a) => (
              <tr key={a.id}>
                <td>{a.modelo}</td>
                <td>{ref.categoryName(a.category_id)}</td>
                <td>{a.patrimonio ?? '—'}</td>
                <td>{a.serial_number ?? '—'}</td>
                <td><StatusPill label={ACCESSORY_STATUS_LABEL[a.status]} tone={statusTone(a.status)} /></td>
                <td>{ref.employeeName(a.employee_id)}</td>
                <td>{ref.locationName(a.location_id)}</td>
                {canManage && (
                  <td>
                    <div className="row-actions">
                      <button className="button-small" onClick={() => setEditing(a)}>Editar</button>
                      {a.employee_id ? (
                        <button className="button-small" onClick={() => unassignAccessory(a.id).then(reload)}>Desvincular</button>
                      ) : (
                        <button className="button-small" onClick={() => setAssigning(a)}>Atribuir</button>
                      )}
                      <button className="button-small button-danger" onClick={() => setAccessoryDeactivated(a.id, true).then(reload)}>Desativar</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span>{count} acessório(s) — página {page + 1} de {totalPages}</span>
          <button className="button-secondary" disabled={page === 0} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>Anterior</button>
          <button className="button-secondary" disabled={page + 1 >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>Próxima</button>
        </div>
      </div>

      {editing && (
        <AccessoryFormModal
          accessory={editing === 'new' ? undefined : editing}
          categories={ref.categories}
          locations={ref.locations}
          employees={ref.employees}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {assigning && (
        <AssignEmployeeModal
          employees={ref.employees}
          onConfirm={(employeeId, notes) => assignAccessory(assigning.id, employeeId, notes).then(reload)}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  )
}
