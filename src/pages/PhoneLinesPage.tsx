import { useEffect, useState } from 'react'
import { listPhoneLines, setPhoneLineDeactivated, assignPhoneLine, unassignPhoneLine } from '@/services/phoneLines'
import type { PhoneLineFilters } from '@/services/phoneLines'
import type { PhoneLine } from '@/types/domain'
import { PHONE_LINE_STATUS_LABEL } from '@/types/domain'
import { useReferenceData } from '@/hooks/useReferenceData'
import { useAuth } from '@/hooks/useAuth'
import { StatusPill } from '@/components/StatusPill'
import { PhoneLineFormModal } from '@/components/PhoneLineFormModal'
import { AssignEmployeeModal } from '@/components/AssignEmployeeModal'
import { InvoiceUploadsPanel } from '@/components/InvoiceUploadsPanel'

const PAGE_SIZE = 15

function statusTone(status: string) {
  if (status === 'ASSIGNED') return 'ok'
  if (status === 'CANCELLED') return 'danger'
  if (status === 'AVAILABLE') return 'neutral'
  return 'warn'
}

export function PhoneLinesPage() {
  const ref = useReferenceData()
  const { profile } = useAuth()
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'MASTER'
  const isMaster = profile?.role === 'MASTER'

  const [tab, setTab] = useState<'linhas' | 'faturas'>('linhas')
  const [filters, setFilters] = useState<PhoneLineFilters>({ page: 0 })
  const [rows, setRows] = useState<PhoneLine[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PhoneLine | 'new' | null>(null)
  const [assigning, setAssigning] = useState<PhoneLine | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const result = await listPhoneLines({ ...filters, pageSize: PAGE_SIZE })
      setRows(result.data)
      setCount(result.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar linhas')
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

  return (
    <div>
      <div className="page-header">
        <h2>Linhas telefônicas</h2>
        {tab === 'linhas' && canManage && (
          <button className="button-primary" style={{ width: 'auto' }} onClick={() => setEditing('new')}>
            + Nova linha
          </button>
        )}
      </div>

      {isMaster && (
        <div className="tabs">
          <button className={`tab ${tab === 'linhas' ? 'active' : ''}`} onClick={() => setTab('linhas')}>Linhas</button>
          <button className={`tab ${tab === 'faturas' ? 'active' : ''}`} onClick={() => setTab('faturas')}>Faturas</button>
        </div>
      )}

      {tab === 'faturas' && isMaster ? (
        <InvoiceUploadsPanel />
      ) : (
        <>
      <div className="filters-bar">
        <input
          placeholder="Buscar por número ou responsável…"
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 0 }))}
        />
        <select onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as never, page: 0 }))}>
          <option value="">Todos os status</option>
          {Object.entries(PHONE_LINE_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select onChange={(e) => setFilters((f) => ({ ...f, carrierId: e.target.value || undefined, page: 0 }))}>
          <option value="">Todas as operadoras</option>
          {ref.carriers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
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
              <th>Número</th>
              <th>Operadora</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Departamento</th>
              {canManage && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="empty-state">Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhuma linha encontrada</td></tr>}
            {!loading && rows.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>{ref.carrierName(p.carrier_id)}</td>
                <td><StatusPill label={PHONE_LINE_STATUS_LABEL[p.status]} tone={statusTone(p.status)} /></td>
                <td>{ref.employeeName(p.assigned_employee_id)}</td>
                <td>{ref.departmentName(p.department_id)}</td>
                {canManage && (
                  <td>
                    <div className="row-actions">
                      <button className="button-small" onClick={() => setEditing(p)}>Editar</button>
                      {p.assigned_employee_id ? (
                        <button className="button-small" onClick={() => unassignPhoneLine(p.id).then(reload)}>Desvincular</button>
                      ) : (
                        <button className="button-small" onClick={() => setAssigning(p)}>Atribuir</button>
                      )}
                      <button className="button-small button-danger" onClick={() => setPhoneLineDeactivated(p.id, true).then(reload)}>Desativar</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span>{count} linha(s) — página {page + 1} de {totalPages}</span>
          <button className="button-secondary" disabled={page === 0} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>Anterior</button>
          <button className="button-secondary" disabled={page + 1 >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>Próxima</button>
        </div>
      </div>

      {editing && (
        <PhoneLineFormModal
          phoneLine={editing === 'new' ? undefined : editing}
          carriers={ref.carriers}
          employees={ref.employees}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {assigning && (
        <AssignEmployeeModal
          employees={ref.employees}
          onConfirm={(employeeId, notes) => assignPhoneLine(assigning.id, employeeId, notes).then(reload)}
          onClose={() => setAssigning(null)}
        />
      )}
        </>
      )}
    </div>
  )
}
