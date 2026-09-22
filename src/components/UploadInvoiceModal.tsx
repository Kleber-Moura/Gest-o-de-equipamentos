import { useState } from 'react'
import type { Carrier } from '@/types/domain'
import { uploadInvoice } from '@/services/invoiceUploads'

interface Props {
  carriers: Carrier[]
  onClose: () => void
  onDone: () => void
}

export function UploadInvoiceModal({ carriers, onClose, onDone }: Props) {
  const [carrierId, setCarrierId] = useState(carriers[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!carrierId || !file) {
      setError('Selecione a operadora e o arquivo PDF da fatura.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await uploadInvoice(file, carrierId)
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a fatura')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Enviar fatura</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Operadora</label>
            <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} disabled={submitting}>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Arquivo da fatura (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              disabled={submitting}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          A IA (Gemini) lê o PDF e identifica o valor cobrado de cada linha automaticamente,
          atualizando a base — pode levar alguns segundos.
        </p>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={submitting || !file} onClick={handleSubmit}>
            {submitting ? 'Lendo fatura…' : 'Enviar e processar'}
          </button>
        </div>
      </div>
    </div>
  )
}
