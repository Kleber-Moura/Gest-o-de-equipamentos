import { useMemo, useState } from 'react'
import { useReferenceData } from '@/hooks/useReferenceData'
import { setEmployeeActive, deactivateEmployee } from '@/services/employees'
import { EmployeeFormModal } from '@/components/EmployeeFormModal'
import { EmployeeAssetsModal } from '@/components/EmployeeAssetsModal'
import type { Employee } from '@/types/domain'

export function EmployeesPage() {
  const ref = useReferenceData()
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [activeFilter, setActiveFilter] = useState<'' | 'active' | 'inactive'>('')
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [viewingAssetsOf, setViewingAssetsOf] = useState<Employee | null>(null)
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | null>(null)

  function cycleNameSort() {
    setNameSort((s) => (s === null ? 'asc' : s === 'asc' ? 'desc' : null))
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const result = ref.employees.filter((e) => {
      if (term) {
        const matches =
          e.name.toLowerCase().includes(term) ||
          e.username?.toLowerCase().includes(term) ||
          e.email?.toLowerCase().includes(term)
        if (!matches) return false
      }
      if (departmentId && e.department_id !== departmentId) return false
      if (locationId && e.location_id !== locationId) return false
      if (activeFilter === 'active' && !e.active) return false
      if (activeFilter === 'inactive' && e.active) return false
      return true
    })
    if (nameSort) {
      result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') * (nameSort === 'desc' ? -1 : 1))
    }
    return result
  }, [ref.employees, search, departmentId, locationId, activeFilter, nameSort])

  return (
    <div>
      <div className="page-header">
        <h2>Colaboradores</h2>
        <button className="button-primary" style={{ width: 'auto' }} onClick={() => setEditing('new')}>
          + Adicionar
        </button>
      </div>

      <div className="filters-bar">
        <input placeholder="Buscar por nome, username ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Todos os departamentos</option>
          {ref.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Todas as localidades</option>
          {ref.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as '' | 'active' | 'inactive')}>
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} colaborador(es)
        </span>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={cycleNameSort}>
                Nome
                {nameSort && <span className="sort-indicator">{nameSort === 'desc' ? '▼' : '▲'}</span>}
              </th>
              <th>Username</th><th>E-mail</th><th>Departamento</th><th>Localidade</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ref.loading && <tr><td colSpan={7} className="empty-state">Carregando…</td></tr>}
            {!ref.loading && filtered.length === 0 && <tr><td colSpan={7} className="empty-state">Nenhum colaborador encontrado</td></tr>}
            {!ref.loading && filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.name}{e.is_shared_asset_holder && ' 🏢'}</td>
                <td>{e.username ?? '—'}</td>
                <td>{e.email ?? '—'}</td>
                <td>{ref.departmentName(e.department_id)}</td>
                <td>{ref.locationName(e.location_id)}</td>
                <td>
                  <span className={`status-pill ${e.active ? 'status-ok' : 'status-neutral'}`}>{e.active ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="button-small" onClick={() => setViewingAssetsOf(e)}>Ver vínculos</button>
                    <button className="button-small" onClick={() => setEditing(e)}>Editar</button>
                    <button
                      className="button-small"
                      onClick={() =>
                        (e.active ? deactivateEmployee(e.id) : setEmployeeActive(e.id, true)).then(ref.reload)
                      }
                    >
                      {e.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EmployeeFormModal
          employee={editing === 'new' ? undefined : editing}
          departments={ref.departments}
          locations={ref.locations}
          onClose={() => setEditing(null)}
          onSaved={ref.reload}
        />
      )}
      {viewingAssetsOf && (
        <EmployeeAssetsModal employee={viewingAssetsOf} onClose={() => setViewingAssetsOf(null)} />
      )}
    </div>
  )
}
