import { useEffect, useState } from 'react'
import type { Accessory, Employee, Notebook, PhoneLine } from '@/types/domain'
import { NOTEBOOK_STATUS_LABEL, ACCESSORY_STATUS_LABEL, PHONE_LINE_STATUS_LABEL } from '@/types/domain'
import { getEmployeeAssets, type EmployeeAssets } from '@/services/employeeAssets'
import { useReferenceData } from '@/hooks/useReferenceData'

function statusTone(status: string) {
  if (status === 'ASSIGNED') return 'ok'
  if (status === 'BROKEN' || status === 'DECOMMISSIONED' || status === 'CANCELLED') return 'danger'
  if (status === 'AVAILABLE') return 'neutral'
  return 'warn'
}

export function EmployeeAssetsModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const ref = useReferenceData()
  const [assets, setAssets] = useState<EmployeeAssets | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEmployeeAssets(employee.id).then(setAssets).catch((err) => setError(err.message))
  }, [employee.id])

  const total = assets ? assets.notebooks.length + assets.accessories.length + assets.phoneLines.length : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <h2>Vínculos de {employee.name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          {employee.email ?? employee.username ?? 'Sem e-mail/username cadastrado'} ·{' '}
          {ref.departmentName(employee.department_id)} · {ref.locationName(employee.location_id)}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {!assets && !error && <p>Carregando…</p>}

        {assets && (
          <>
            {total === 0 && <p className="empty-state">Nenhum ativo vinculado a este colaborador.</p>}

            {assets.notebooks.length > 0 && (
              <AssetSection title={`Notebooks (${assets.notebooks.length})`}>
                {assets.notebooks.map((n) => <NotebookCard key={n.id} notebook={n} />)}
              </AssetSection>
            )}

            {assets.accessories.length > 0 && (
              <AssetSection title={`Acessórios (${assets.accessories.length})`}>
                {assets.accessories.map((a) => (
                  <AccessoryCard key={a.id} accessory={a} categoryName={ref.categoryName(a.category_id)} />
                ))}
              </AssetSection>
            )}

            {assets.phoneLines.length > 0 && (
              <AssetSection title={`Linhas telefônicas (${assets.phoneLines.length})`}>
                {assets.phoneLines.map((p) => (
                  <PhoneLineCard key={p.id} phoneLine={p} carrierName={ref.carrierName(p.carrier_id)} />
                ))}
              </AssetSection>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function AssetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function AssetCardShell({
  title,
  statusLabel,
  tone,
  fields,
}: {
  title: string
  statusLabel: string
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
  fields: Array<{ label: string; value: string }>
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>{title}</div>
        <span className={`status-pill status-${tone}`}>{statusLabel}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
        {fields.map((f) => (
          <div key={f.label} style={{ fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>{f.label}: </span>
            <span style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NotebookCard({ notebook }: { notebook: Notebook }) {
  return (
    <AssetCardShell
      title={notebook.modelo}
      statusLabel={NOTEBOOK_STATUS_LABEL[notebook.status]}
      tone={statusTone(notebook.status)}
      fields={[
        { label: 'Patrimônio', value: notebook.patrimonio },
        { label: 'Serial', value: notebook.serial_number },
      ]}
    />
  )
}

function AccessoryCard({ accessory, categoryName }: { accessory: Accessory; categoryName: string }) {
  const fields = [{ label: 'Categoria', value: categoryName }]
  if (accessory.patrimonio) fields.push({ label: 'Patrimônio', value: accessory.patrimonio })
  if (accessory.serial_number) fields.push({ label: 'Serial', value: accessory.serial_number })

  return (
    <AssetCardShell
      title={accessory.modelo}
      statusLabel={ACCESSORY_STATUS_LABEL[accessory.status]}
      tone={statusTone(accessory.status)}
      fields={fields}
    />
  )
}

function PhoneLineCard({ phoneLine, carrierName }: { phoneLine: PhoneLine; carrierName: string }) {
  return (
    <AssetCardShell
      title={phoneLine.number}
      statusLabel={PHONE_LINE_STATUS_LABEL[phoneLine.status]}
      tone={statusTone(phoneLine.status)}
      fields={[{ label: 'Operadora', value: carrierName }]}
    />
  )
}
