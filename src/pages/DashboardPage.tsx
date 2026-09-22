import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Laptop, Mouse, Smartphone, type LucideIcon } from 'lucide-react'
import { loadDashboardStats, type DashboardStats } from '@/services/dashboard'
import { HealthDonut, type DonutSegment } from '@/components/HealthDonut'
import { TelephonyDashboardPanel } from '@/components/TelephonyDashboardPanel'
import { exportElementToPdf } from '@/lib/exportElementToPdf'

const BLUE = '#006bb7'
const TEAL = '#16b3c1'
const CRITICAL = '#d03b3b'
const WARNING = '#fab219'
const MUTED = '#3c5f85'

function sum(record: Record<string, number>) {
  return Object.values(record).reduce((a, b) => a + b, 0)
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function toChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }))
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadDashboardStats().then(setStats).catch((err) => setError(err.message))
  }, [])

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    setExporting(true)
    setExportError(null)
    try {
      const fileName = `dashboard-km-${new Date().toISOString().slice(0, 10)}.pdf`
      await exportElementToPdf(dashboardRef.current, fileName)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Erro ao exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>
  if (!stats) return <p>Carregando indicadores…</p>

  const notebooksTotal = sum(stats.notebooksByStatus)
  const accessoriesTotal = sum(stats.accessoriesByStatus)
  const phoneLinesTotal = sum(stats.phoneLinesByStatus)

  const notebookSegments: DonutSegment[] = [
    { label: 'Atribuídos', value: stats.notebooksByStatus.ASSIGNED ?? 0, color: BLUE },
    { label: 'Disponíveis', value: stats.notebooksByStatus.AVAILABLE ?? 0, color: TEAL },
    { label: 'Quebrados', value: stats.notebooksByStatus.BROKEN ?? 0, color: CRITICAL },
    {
      label: 'Outros',
      value:
        (stats.notebooksByStatus.MAINTENANCE ?? 0) +
        (stats.notebooksByStatus.RESERVE ?? 0) +
        (stats.notebooksByStatus.DECOMMISSIONED ?? 0),
      color: MUTED,
    },
  ]

  const accessorySegments: DonutSegment[] = [
    { label: 'Atribuídos', value: stats.accessoriesByStatus.ASSIGNED ?? 0, color: BLUE },
    { label: 'Disponíveis', value: stats.accessoriesByStatus.AVAILABLE ?? 0, color: TEAL },
    {
      label: 'Quebrados/Baixados',
      value: (stats.accessoriesByStatus.BROKEN ?? 0) + (stats.accessoriesByStatus.DECOMMISSIONED ?? 0),
      color: CRITICAL,
    },
    { label: 'Manutenção', value: stats.accessoriesByStatus.MAINTENANCE ?? 0, color: MUTED },
  ]

  const lifecycleSegments: DonutSegment[] = [
    { label: 'Troca vencida', value: stats.notebooksByLifecycle.TROCAR ?? 0, color: CRITICAL },
    { label: 'Atenção para troca', value: stats.notebooksByLifecycle.ATENCAO ?? 0, color: WARNING },
    { label: 'Dentro da vida útil', value: stats.notebooksByLifecycle.DENTRO_DA_VIDA_UTIL ?? 0, color: TEAL },
  ]

  return (
    <div className={`dashboard-dark${exporting ? ' is-exporting' : ''}`} ref={dashboardRef}>
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <div className="subtitle">Visão geral da infraestrutura de TI — KM</div>
        </div>
        <button className="button-primary dashboard-export-btn" disabled={exporting} onClick={handleExportPdf}>
          {exporting ? 'Gerando PDF…' : 'Exportar PDF'}
        </button>
      </div>
      {exportError && <div className="alert alert-error">{exportError}</div>}

      <div className="hero-grid">
        <HeroCard label="Notebooks" value={notebooksTotal} glow="teal" icon={Laptop} />
        <HeroCard label="Acessórios" value={accessoriesTotal} glow="blue" icon={Mouse} />
        <HeroCard label="Linhas telefônicas" value={phoneLinesTotal} glow="teal" icon={Smartphone} />
      </div>

      <div className="dashboard-section-label">Saúde da frota</div>
      <div className="donut-grid">
        <HealthDonut
          title="Notebooks"
          segments={notebookSegments}
          centerValue={`${pct(stats.notebooksByStatus.ASSIGNED ?? 0, notebooksTotal)}%`}
          centerCaption="em uso"
        />
        <HealthDonut
          title="Acessórios"
          segments={accessorySegments}
          centerValue={`${pct(stats.accessoriesByStatus.ASSIGNED ?? 0, accessoriesTotal)}%`}
          centerCaption="em uso"
        />
        <HealthDonut
          title="Ciclo de vida — notebooks"
          segments={lifecycleSegments}
          centerValue={`${pct(stats.notebooksByLifecycle.TROCAR ?? 0, notebooksTotal)}%`}
          centerCaption="p/ trocar"
        />
      </div>

      <div className="dashboard-section-label">Distribuição</div>
      <div className="chart-grid">
        <TechBarCard title="Notebooks por localidade" data={toChartData(stats.notebooksByLocation)} color={TEAL} />
        <TechBarCard title="Acessórios por categoria" data={toChartData(stats.accessoriesByCategory)} color={BLUE} />
      </div>

      <div className="dashboard-section-label">Telefonia</div>
      <TelephonyDashboardPanel />
    </div>
  )
}

function HeroCard({
  label,
  value,
  glow,
  icon: Icon,
}: {
  label: string
  value: number
  glow: 'teal' | 'blue'
  icon?: LucideIcon
}) {
  const glowStyle =
    glow === 'blue'
      ? { '--hero-glow': 'linear-gradient(135deg, rgba(0,107,183,0.35), rgba(11,235,248,0.06))' }
      : { '--hero-glow': 'linear-gradient(135deg, rgba(11,235,248,0.3), rgba(0,107,183,0.05))' }

  return (
    <div className="hero-card" style={glowStyle as React.CSSProperties}>
      <div className="hero-card-body">
        <div>
          <div className="hero-card-value">{value}</div>
          <div className="hero-card-label">{label}</div>
        </div>
        {Icon && (
          <div className="hero-card-icon-wrap">
            <Icon className="hero-card-icon" strokeWidth={1.8} />
          </div>
        )}
      </div>
    </div>
  )
}

function TechBarCard({ title, data, color }: { title: string; data: Array<{ name: string; value: number }>; color: string }) {
  return (
    <div className="tech-chart-card">
      <h3>{title}</h3>
      {data.length === 0 ? (
        <p style={{ color: 'var(--shell-ink-muted)', fontSize: 13 }}>Sem dados</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="name" fontSize={11} tick={{ fill: 'var(--shell-ink-muted)' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} fontSize={11} tick={{ fill: 'var(--shell-ink-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-h)' }}
              cursor={{ fill: 'var(--veil-1)' }}
            />
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
