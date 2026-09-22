import { useState } from 'react'
import type { Accessory, AssetCategory, Employee, Location } from '@/types/domain'
import { ACCESSORY_STATUS_LABEL, type AccessoryStatus } from '@/types/domain'
import { createAccessory, updateAccessory, assignAccessory, unassignAccessory } from '@/services/accessories'

interface Props {
  accessory?: Accessory
  categories: AssetCategory[]
  locations: Location[]
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

export function AccessoryFormModal({ accessory, categories, locations, employees, onClose, onSaved }: Props) {
  const [patrimonio, setPatrimonio] = useState(accessory?.patrimonio ?? '')
  const [serialNumber, setSerialNumber] = useState(accessory?.serial_number ?? '')
  const [modelo, setModelo] = useState(accessory?.modelo ?? '')
  const [categoryId, setCategoryId] = useState(accessory?.category_id ?? categories[0]?.id ?? '')
  const [status, setStatus] = useState<AccessoryStatus>(accessory?.status ?? 'AVAILABLE')
  const [locationId, setLocationId] = useState(accessory?.location_id ?? locations[0]?.id ?? '')
  const [employeeId, setEmployeeId] = useState(accessory?.employee_id ?? '')
  const [notes, setNotes] = useState(accessory?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        patrimonio: patrimonio || null,
        serial_number: serialNumber || null,
        modelo,
        category_id: categoryId,
        status,
        location_id: locationId,
        notes: notes || null,
      }
      if (accessory) {
        await updateAccessory(accessory.id, payload)
        const originalEmployeeId = accessory.employee_id ?? ''
        if (employeeId !== originalEmployeeId) {
          if (employeeId) await assignAccessory(accessory.id, employeeId)
          else await unassignAccessory(accessory.id)
        }
      } else {
        const created = await createAccessory(payload)
        if (employeeId) await assignAccessory(created.id, employeeId)
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
        <h2>{accessory ? 'Editar acessório' : 'Novo acessório'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Categoria</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Modelo</label>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} required />
          </div>
          <div className="field">
            <label>Patrimônio (opcional)</label>
            <input value={patrimonio ?? ''} onChange={(e) => setPatrimonio(e.target.value)} />
          </div>
          <div className="field">
            <label>Número de série (opcional)</label>
            <input value={serialNumber ?? ''} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AccessoryStatus)}>
              {Object.entries(ACCESSORY_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Responsável (opcional)</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Nenhum — em estoque</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Localidade</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Observações</label>
            <input value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
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
