import { supabase } from '@/lib/supabaseClient'

function tally(rows: Array<Record<string, string>>, key: string): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const row of rows) {
    const value = row[key]
    acc[value] = (acc[value] ?? 0) + 1
  }
  return acc
}

export interface DashboardStats {
  notebooksByStatus: Record<string, number>
  notebooksByLifecycle: Record<string, number>
  notebooksByLocation: Record<string, number>
  accessoriesByStatus: Record<string, number>
  accessoriesByCategory: Record<string, number>
  phoneLinesByStatus: Record<string, number>
}

/** Cada consulta busca só a(s) coluna(s) necessárias e agrega no cliente — com a base
 * atual (centenas de linhas, não milhares) isso é mais simples e mais rápido de manter
 * do que uma RPC de agregação, sem sacrificar performance real. */
export async function loadDashboardStats(): Promise<DashboardStats> {
  const [notebooks, accessories, phoneLines, categories, locations] = await Promise.all([
    supabase.from('notebooks_with_lifecycle').select('status,lifecycle_status,location_id'),
    supabase.from('accessories').select('status,category_id').is('deleted_at', null),
    supabase.from('phone_lines').select('status').is('deleted_at', null),
    supabase.from('asset_categories').select('id,name'),
    supabase.from('locations').select('id,name'),
  ])

  if (notebooks.error) throw notebooks.error
  if (accessories.error) throw accessories.error
  if (phoneLines.error) throw phoneLines.error
  if (categories.error) throw categories.error
  if (locations.error) throw locations.error

  const categoryNameById = new Map((categories.data ?? []).map((c) => [c.id, c.name]))
  const locationNameById = new Map((locations.data ?? []).map((l) => [l.id, l.name]))

  const accessoriesByCategoryId = tally(accessories.data ?? [], 'category_id')
  const accessoriesByCategory: Record<string, number> = {}
  for (const [id, count] of Object.entries(accessoriesByCategoryId)) {
    accessoriesByCategory[categoryNameById.get(id) ?? 'Outra'] = count
  }

  const notebooksByLocationId = tally(notebooks.data ?? [], 'location_id')
  const notebooksByLocation: Record<string, number> = {}
  for (const [id, count] of Object.entries(notebooksByLocationId)) {
    notebooksByLocation[locationNameById.get(id) ?? 'Outra'] = count
  }

  return {
    notebooksByStatus: tally(notebooks.data ?? [], 'status'),
    notebooksByLifecycle: tally(notebooks.data ?? [], 'lifecycle_status'),
    notebooksByLocation,
    accessoriesByStatus: tally(accessories.data ?? [], 'status'),
    accessoriesByCategory,
    phoneLinesByStatus: tally(phoneLines.data ?? [], 'status'),
  }
}
