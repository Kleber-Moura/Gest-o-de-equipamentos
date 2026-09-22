import { useState } from 'react'
import type { Carrier, Employee, PhoneLine } from '@/types/domain'
import { PHONE_LINE_STATUS_LABEL, type PhoneLineStatus } from '@/types/domain'
import { createPhoneLine, updatePhoneLine, assignPhoneLine, unassignPhoneLine } from '@/services/phoneLines'

interface Props {
  phoneLine?: PhoneLine
  carriers: Carrier[]
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

export function PhoneLineFormModal({ phoneLine, carriers, employees, onClose, onSaved }: Props) {
  const [number, setNumber] = useState(phoneLine?.number ?? '')
  const [carrierId, setCarrierId] = useState(phoneLine?.carrier_id ?? carriers[0]?.id ?? '')
  const [status, setStatus] = useState<PhoneLineStatus>(phoneLine?.status ?? 'AVAILABLE')
  const [employeeId, setEmployeeId] = useState(phoneLine?.assigned_employee_id ?? '')
  const [iccid, setIccid] = useState(phoneLine?.iccid ?? '')
  const [imei, setImei] = useState(phoneLine?.imei ?? '')
  const [eid, setEid] = useState(phoneLine?.eid ?? '')
  const [chipType, setChipType] = useState(phoneLine?.chip_type ?? '')
  const [notes, setNotes] = useState(phoneLine?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        number,
        carrier_id: carrierId,
        status,
        iccid: iccid || null,
        imei: imei || null,
        eid: eid || null,
        chip_type: chipType || null,
        notes: notes || null,
      }
      if (phoneLine) {
        await updatePhoneLine(phoneLine.id, payload)
        const originalEmployeeId = phoneLine.assigned_employee_id ?? ''
        if (employeeId !== originalEmployeeId) {
          if (employeeId) await assignPhoneLine(phoneLine.id, employeeId)
          else await unassignPhoneLine(phoneLine.id)
        }
      } else {
        const created = await createPhoneLine(payload)
        if (employeeId) await assignPhoneLine(created.id, employeeId)
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
        <h2>{phoneLine ? 'Editar linha' : 'Nova linha'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Número (formato +55...)</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+5511987654321" required />
          </div>
          <div className="field">
            <label>Operadora</label>
            <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as PhoneLineStatus)}>
              {Object.entries(PHONE_LINE_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Responsável (opcional)</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Nenhum</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tipo de chip</label>
            <input value={chipType ?? ''} onChange={(e) => setChipType(e.target.value)} />
          </div>
          <div className="field">
            <label>ICCID</label>
            <input value={iccid ?? ''} onChange={(e) => setIccid(e.target.value)} />
          </div>
          <div className="field">
            <label>IMEI</label>
            <input value={imei ?? ''} onChange={(e) => setImei(e.target.value)} />
          </div>
          <div className="field">
            <label>EID</label>
            <input value={eid ?? ''} onChange={(e) => setEid(e.target.value)} />
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
