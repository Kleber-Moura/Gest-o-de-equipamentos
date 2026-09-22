import { useState } from 'react'
import type { Employee } from '@/types/domain'

interface Props {
  employees: Employee[]
  onConfirm: (employeeId: string, notes: string) => Promise<void>
  onClose: () => void
}

/** Modal genérico de atribuição, reaproveitado por notebooks/acessórios/linhas —
 * a única diferença entre eles é qual serviço/RPC é chamado no onConfirm. */
export function AssignEmployeeModal({ employees, onConfirm, onClose }: Props) {
  const [employeeId, setEmployeeId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!employeeId) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(employeeId, notes)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atribuir')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Atribuir a um colaborador</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Colaborador</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Selecione…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Observação (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={!employeeId || submitting} onClick={handleSubmit}>
            {submitting ? 'Atribuindo…' : 'Atribuir'}
          </button>
        </div>
      </div>
    </div>
  )
}
