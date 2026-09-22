import { useEffect, useState } from 'react'
import { listInvoiceUploads } from '@/services/invoiceUploads'
import { listActorNames } from '@/services/auditLogs'
import type { InvoiceUpload } from '@/types/domain'
import { INVOICE_UPLOAD_STATUS_LABEL } from '@/types/domain'
import { useReferenceData } from '@/hooks/useReferenceData'
import { StatusPill } from '@/components/StatusPill'
import { UploadInvoiceModal } from '@/components/UploadInvoiceModal'

function statusTone(status: string) {
  if (status === 'DONE') return 'ok'
  if (status === 'ERROR') return 'danger'
  return 'warn'
}

/** Controle de faturas de telefonia — upload de PDF (Vivo/Claro) lido por IA
 * (Gemini), restrito a MASTER. Cada envio gera uma linha aqui e atualiza
 * phone_invoices por trás (ver Edge Function process-invoice). */
export function InvoiceUploadsPanel() {
  const ref = useReferenceData()
  const [uploads, setUploads] = useState<InvoiceUpload[]>([])
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const [rows, names] = await Promise.all([listInvoiceUploads(), listActorNames()])
      setUploads(rows)
      setActorNames(names)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar faturas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  return (
    <div>
      <div className="page-header">
        <h3 style={{ fontSize: 15 }}>Faturas — leitura automática por IA</h3>
        <button className="button-primary" style={{ width: 'auto' }} onClick={() => setUploadOpen(true)}>
          + Enviar fatura
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Operadora</th>
              <th>Enviado por</th>
              <th>Quando</th>
              <th>Status</th>
              <th>Linhas (extraídas/casadas)</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="empty-state">Carregando…</td></tr>}
            {!loading && uploads.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Nenhuma fatura enviada ainda</td></tr>
            )}
            {!loading && uploads.map((u) => (
              <tr key={u.id}>
                <td>{u.file_name}</td>
                <td>{ref.carrierName(u.carrier_id)}</td>
                <td>{u.uploaded_by ? actorNames.get(u.uploaded_by) ?? '—' : '—'}</td>
                <td>{new Date(u.created_at).toLocaleString('pt-BR')}</td>
                <td>
                  <StatusPill label={INVOICE_UPLOAD_STATUS_LABEL[u.status]} tone={statusTone(u.status)} />
                  {u.status === 'ERROR' && u.error_message && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{u.error_message}</div>
                  )}
                </td>
                <td>{u.status === 'DONE' ? `${u.lines_extracted ?? 0} / ${u.lines_matched ?? 0}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {uploadOpen && (
        <UploadInvoiceModal carriers={ref.carriers} onClose={() => setUploadOpen(false)} onDone={reload} />
      )}
    </div>
  )
}
