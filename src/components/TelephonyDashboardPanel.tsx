import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useReferenceData } from '@/hooks/useReferenceData'
import { listAllPhoneLines, listPhoneInvoices } from '@/services/telephony'
import type { PhoneInvoice, PhoneLine } from '@/types/domain'
import { HealthDonut, type DonutSegment } from '@/components/HealthDonut'

const TEAL = '#16b3c1'
const BLUE = '#006bb7'
const CARRIER_PALETTE = [TEAL, BLUE, '#fab219', '#3c5f85']

// Ano comercial: outubro a setembro. Ex.: "2024/2025" cobre out/2024–set/2025.
const FISCAL_CAL_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const FISCAL_LABEL = ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set']

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function fiscalYearOf(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return m >= 10 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

export function TelephonyDashboardPanel() {
  const ref = useReferenceData()
  const [lines, setLines] = useState<PhoneLine[] | null>(null)
  const [invoices, setInvoices] = useState<PhoneInvoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [departmentId, setDepartmentId] = useState('')
  const [carrierIds, setCarrierIds] = useState<Set<string>>(new Set())
  const [fiscalYear, setFiscalYear] = useState('')
  const [month, setMonth] = useState('')

  useEffect(() => {
    Promise.all([listAllPhoneLines(), listPhoneInvoices()])
      .then(([l, i]) => {
        setLines(l)
        setInvoices(i)
      })
      .catch((err) => setError(err.message))
  }, [])

  const employeeById = useMemo(() => new Map(ref.employees.map((e) => [e.id, e])), [ref.employees])

  const fiscalYears = useMemo(() => {
    const set = new Set((invoices ?? []).map((i) => fiscalYearOf(i.invoice_date)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [invoices])

  useEffect(() => {
    if (!fiscalYear && fiscalYears.length > 0) setFiscalYear(fiscalYears[0])
  }, [fiscalYear, fiscalYears])

  const carrierColor = useMemo(() => {
    const ids = ref.carriers.map((c) => c.id).sort()
    const map = new Map<string, string>()
    ids.forEach((id, i) => map.set(id, CARRIER_PALETTE[i % CARRIER_PALETTE.length]))
    return map
  }, [ref.carriers])

  function toggleCarrier(id: string) {
    setCarrierIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredLines = useMemo(() => {
    return (lines ?? []).filter((l) => {
      if (carrierIds.size > 0 && !carrierIds.has(l.carrier_id)) return false
      if (departmentId) {
        const emp = l.assigned_employee_id ? employeeById.get(l.assigned_employee_id) : null
        if (emp?.department_id !== departmentId) return false
      }
      return true
    })
  }, [lines, carrierIds, departmentId, employeeById])

  const lineIds = useMemo(() => new Set(filteredLines.map((l) => l.id)), [filteredLines])

  const totalLinhas = filteredLines.length
  const totalAtribuidas = filteredLines.filter((l) => l.status === 'ASSIGNED').length
  const totalDisponiveis = filteredLines.filter((l) => l.status === 'AVAILABLE').length

  const donutSegments: DonutSegment[] = useMemo(() => {
    const byCarrier = new Map<string, number>()
    for (const l of filteredLines) byCarrier.set(l.carrier_id, (byCarrier.get(l.carrier_id) ?? 0) + 1)
    return ref.carriers
      .map((c) => ({ label: c.name, value: byCarrier.get(c.id) ?? 0, color: carrierColor.get(c.id) ?? TEAL }))
      .filter((s) => s.value > 0)
  }, [filteredLines, ref.carriers, carrierColor])

  // Custo por operadora, mês a mês, dentro do ano comercial selecionado (out→set) —
  // cada linha do gráfico tem uma chave por carrier_id (dataKey dinâmico do recharts).
  const fiscalMonthlyByCarrier = useMemo(() => {
    if (!fiscalYear) return []
    const startYear = Number(fiscalYear.split('/')[0])
    const monthKeys = FISCAL_CAL_MONTHS.map((m) => `${m >= 10 ? startYear : startYear + 1}-${String(m).padStart(2, '0')}`)
    const rows: Array<Record<string, string | number>> = monthKeys.map((key, i) => ({ name: FISCAL_LABEL[i], __key: key }))
    const rowByKey = new Map(rows.map((r) => [r.__key as string, r]))

    for (const inv of invoices ?? []) {
      if (month && inv.invoice_date.slice(5, 7) !== month) continue
      const matchesLine = inv.phone_line_id ? lineIds.has(inv.phone_line_id) : carrierIds.size === 0 || carrierIds.has(inv.carrier_id)
      if (!matchesLine) continue
      const row = rowByKey.get(inv.invoice_date.slice(0, 7))
      if (!row) continue
      row[inv.carrier_id] = (Number(row[inv.carrier_id]) || 0) + Number(inv.amount)
    }
    return rows
  }, [invoices, fiscalYear, month, lineIds, carrierIds])

  const carrierTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of fiscalMonthlyByCarrier) {
      for (const c of ref.carriers) {
        totals.set(c.id, (totals.get(c.id) ?? 0) + (Number(row[c.id]) || 0))
      }
    }
    return totals
  }, [fiscalMonthlyByCarrier, ref.carriers])

  const totalCost = useMemo(() => Array.from(carrierTotals.values()).reduce((a, b) => a + b, 0), [carrierTotals])

  if (error) return <div className="alert alert-error">{error}</div>
  if (!lines || !invoices) return <p style={{ color: 'var(--shell-ink-muted)' }}>Carregando telefonia…</p>

  return (
    <div className="telephony-panel">
      <div className="telephony-filters">
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Todos os departamentos</option>
          {ref.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Todos os meses</option>
          {FISCAL_CAL_MONTHS.map((m, i) => (
            <option key={m} value={String(m).padStart(2, '0')}>
              {FISCAL_LABEL[i]}
            </option>
          ))}
        </select>
        <select value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}>
          {fiscalYears.map((y) => (
            <option key={y} value={y}>
              Ano comercial {y}
            </option>
          ))}
        </select>
        <div className="telephony-chip-group">
          <button
            type="button"
            className={`telephony-chip ${carrierIds.size === 0 ? 'active' : ''}`}
            onClick={() => setCarrierIds(new Set())}
          >
            Todas operadoras
          </button>
          {ref.carriers.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`telephony-chip ${carrierIds.has(c.id) ? 'active' : ''}`}
              onClick={() => toggleCarrier(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="telephony-top-grid">
        <div>
          <div className="telephony-stat-row">
            <div className="telephony-stat-tile">
              <div className="telephony-stat-value">{totalLinhas}</div>
              <div className="telephony-stat-label">Linhas</div>
            </div>
            <div className="telephony-stat-tile">
              <div className="telephony-stat-value">{totalAtribuidas}</div>
              <div className="telephony-stat-label">Atribuídas</div>
            </div>
            <div className="telephony-stat-tile">
              <div className="telephony-stat-value">{totalDisponiveis}</div>
              <div className="telephony-stat-label">Disponíveis</div>
            </div>
          </div>
          <HealthDonut
            title="Contagem por operadora"
            segments={donutSegments}
            centerValue={String(totalLinhas)}
            centerCaption="linhas"
          />
        </div>

        <div className="tech-chart-card">
          <h3>Custo Vivo x Claro — ano comercial {fiscalYear}</h3>

          <div className="telephony-stat-row">
            <div className="telephony-stat-tile">
              <div className="telephony-stat-value">{currency.format(totalCost)}</div>
              <div className="telephony-stat-label">Custo total</div>
            </div>
            {ref.carriers.map((c) => (
              <div className="telephony-stat-tile" key={c.id}>
                <div className="telephony-stat-value">{currency.format(carrierTotals.get(c.id) ?? 0)}</div>
                <div className="telephony-stat-label">
                  <span className="telephony-stat-dot" style={{ background: carrierColor.get(c.id) }} />
                  {c.name} {totalCost > 0 ? `(${Math.round(((carrierTotals.get(c.id) ?? 0) / totalCost) * 100)}%)` : ''}
                </div>
              </div>
            ))}
          </div>

          {totalCost === 0 ? (
            <p style={{ color: 'var(--shell-ink-muted)', fontSize: 13 }}>Sem faturas para os filtros selecionados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={fiscalMonthlyByCarrier}>
                <defs>
                  {ref.carriers.map((c) => (
                    <linearGradient key={c.id} id={`carrier-fill-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={carrierColor.get(c.id)} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={carrierColor.get(c.id)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: 'var(--shell-ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  fontSize={11}
                  tick={{ fill: 'var(--shell-ink-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => currency.format(v)}
                  width={72}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-h)' }}
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  formatter={(value) => currency.format(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--shell-ink-muted)' }} />
                {ref.carriers.map((c) => (
                  <Area
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    name={c.name}
                    stroke={carrierColor.get(c.id)}
                    strokeWidth={2}
                    fill={`url(#carrier-fill-${c.id})`}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
