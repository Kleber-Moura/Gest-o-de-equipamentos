import { useState } from 'react'
import type { Employee, Location, NotebookWithLifecycle } from '@/types/domain'
import { NOTEBOOK_STATUS_LABEL, type NotebookStatus } from '@/types/domain'
import { createNotebook, updateNotebook, assignNotebook, unassignNotebook } from '@/services/notebooks'

interface Props {
  notebook?: NotebookWithLifecycle
  locations: Location[]
  employees: Employee[]
  onClose: () => void
  onSaved: () => void
}

export function NotebookFormModal({ notebook, locations, employees, onClose, onSaved }: Props) {
  const [patrimonio, setPatrimonio] = useState(notebook?.patrimonio ?? '')
  const [serialNumber, setSerialNumber] = useState(notebook?.serial_number ?? '')
  const [modelo, setModelo] = useState(notebook?.modelo ?? '')
  const [dataAquisicao, setDataAquisicao] = useState(notebook?.data_aquisicao ?? '')
  const [garantiaFim, setGarantiaFim] = useState(notebook?.garantia_fim ?? '')
  const [status, setStatus] = useState<NotebookStatus>(notebook?.status ?? 'AVAILABLE')
  const [locationId, setLocationId] = useState(notebook?.location_id ?? locations[0]?.id ?? '')
  const [employeeId, setEmployeeId] = useState(notebook?.employee_id ?? '')
  const [notes, setNotes] = useState(notebook?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        patrimonio,
        serial_number: serialNumber,
        modelo,
        data_aquisicao: dataAquisicao,
        garantia_fim: garantiaFim || null,
        status,
        location_id: locationId,
        notes: notes || null,
      }

      if (notebook) {
        await updateNotebook(notebook.id, payload)
        // Vínculo de responsável muda por uma RPC dedicada (não pelo update comum),
        // para gerar o registro no histórico de movimentações — mesma regra que o
        // botão "Atribuir/Desvincular" já usa, só que direto pelo formulário.
        const originalEmployeeId = notebook.employee_id ?? ''
        if (employeeId !== originalEmployeeId) {
          if (employeeId) await assignNotebook(notebook.id, employeeId)
          else await unassignNotebook(notebook.id)
        }
      } else {
        const created = await createNotebook(payload)
        if (employeeId) await assignNotebook(created.id, employeeId)
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
        <h2>{notebook ? 'Editar notebook' : 'Novo notebook'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Patrimônio</label>
            <input value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} required />
          </div>
          <div className="field">
            <label>Número de série</label>
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label>Modelo</label>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} required />
          </div>
          <div className="field">
            <label>Data de aquisição</label>
            <input type="date" value={dataAquisicao} onChange={(e) => setDataAquisicao(e.target.value)} required />
          </div>
          <div className="field">
            <label>Fim da garantia (opcional)</label>
            <input type="date" value={garantiaFim} onChange={(e) => setGarantiaFim(e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as NotebookStatus)}>
              {Object.entries(NOTEBOOK_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
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
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Observações</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
