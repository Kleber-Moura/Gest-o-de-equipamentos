/** Texto amigável de ciclo de vida (item 6 do briefing): "Troca vencida há 2 meses",
 * "Troca em 1 ano e 3 meses", "Troca em 28 dias" — calculado no cliente a partir da
 * data prevista de troca que já vem computada pelo banco (view notebooks_with_lifecycle). */
export function lifecycleFriendlyText(dataPrevistaTroca: string): string {
  const target = new Date(dataPrevistaTroca)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  const overdue = target < today
  const [earlier, later] = overdue ? [target, today] : [today, target]

  let years = later.getFullYear() - earlier.getFullYear()
  let months = later.getMonth() - earlier.getMonth()
  let days = later.getDate() - earlier.getDate()

  if (days < 0) {
    months -= 1
    const daysInPrevMonth = new Date(later.getFullYear(), later.getMonth(), 0).getDate()
    days += daysInPrevMonth
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ano${years > 1 ? 's' : ''}`)
  if (months > 0) parts.push(`${months} ${months > 1 ? 'meses' : 'mês'}`)
  if (days > 0 || parts.length === 0) parts.push(`${days} dia${days !== 1 ? 's' : ''}`)

  const duration = parts.join(' e ')
  return overdue ? `Troca vencida há ${duration}` : `Troca em ${duration}`
}
