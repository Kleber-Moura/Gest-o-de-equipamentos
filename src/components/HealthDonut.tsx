import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

/** Donut de "saúde" do ativo (item pedido: card percentual de quanto está em uso,
 * livre e quebrado) — cor por papel (assigned=azul marca, available=verde marca,
 * broken/decommissioned=vermelho de status reservado), nunca genérica, com legenda
 * sempre visível ao lado (identidade nunca só por cor, por causa do WARN de CVD
 * entre vermelho e verde na validação da paleta). */
export function HealthDonut({
  title,
  segments,
  centerValue,
  centerCaption,
}: {
  title: string
  segments: DonutSegment[]
  centerValue: string
  centerCaption: string
}) {
  const data = segments.filter((s) => s.value > 0)

  return (
    <div className="donut-card">
      <div className="donut-card-chart">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
                paddingAngle={2}
              >
                {data.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : null}
        <div className="donut-center-label">
          <div className="donut-center-value">{centerValue}</div>
          <div className="donut-center-caption">{centerCaption}</div>
        </div>
      </div>
      <div>
        <h3>{title}</h3>
        <div className="donut-legend">
          {segments.map((s) => (
            <div className="donut-legend-item" key={s.label}>
              <span className="donut-legend-dot" style={{ background: s.color }} />
              {s.label}
              <span className="donut-legend-value">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
