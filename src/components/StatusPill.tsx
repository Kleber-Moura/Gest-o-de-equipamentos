type Tone = 'ok' | 'warn' | 'danger' | 'neutral'

export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>
}
