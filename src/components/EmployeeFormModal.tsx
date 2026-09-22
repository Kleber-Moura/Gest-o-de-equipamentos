import { useState } from 'react'
import type { Department, Employee, Location } from '@/types/domain'
import { createEmployee, updateEmployee } from '@/services/employees'

interface Props {
  employee?: Employee
  departments: Department[]
  locations: Location[]
  onClose: () => void
  onSaved: () => void
}

export function EmployeeFormModal({ employee, departments, locations, onClose, onSaved }: Props) {
  const [name, setName] = useState(employee?.name ?? '')
  const [username, setUsername] = useState(employee?.username ?? '')
  const [email, setEmail] = useState(employee?.email ?? '')
  const [departmentId, setDepartmentId] = useState(employee?.department_id ?? '')
  const [locationId, setLocationId] = useState(employee?.location_id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('O nome é obrigatório.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        username: username || null,
        email: email || null,
        department_id: departmentId || null,
        location_id: locationId || null,
      }
      if (employee) {
        await updateEmployee(employee.id, payload)
      } else {
        await createEmployee(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{employee ? 'Editar colaborador' : 'Novo colaborador'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Username (opcional)</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>E-mail (opcional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Departamento</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Nenhum</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Localidade</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Nenhuma</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>Cancelar</button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
