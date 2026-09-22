import { supabase } from '@/lib/supabaseClient'
import type { NotebookStatus, NotebookWithLifecycle, LifecycleStatus } from '@/types/domain'
import { employeeIdsByDepartment, employeeIdsByNameSearch, type ListResult } from '@/services/listUtils'

export interface NotebookFilters {
  status?: NotebookStatus
  employeeId?: string
  locationId?: string
  departmentId?: string
  lifecycleStatus?: LifecycleStatus
  search?: string
  /** Direção do clique em "Patrimônio"; sem valor = ordem padrão (patrimônio crescente). */
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export async function listNotebooks(filters: NotebookFilters = {}): Promise<ListResult<NotebookWithLifecycle>> {
  const { page = 0, pageSize = 20 } = filters
  let query = supabase.from('notebooks_with_lifecycle').select('*', { count: 'exact' })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.lifecycleStatus) query = query.eq('lifecycle_status', filters.lifecycleStatus)
  if (filters.departmentId) {
    const ids = await employeeIdsByDepartment(filters.departmentId)
    query = query.in('employee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }
  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, '')
    const employeeIds = await employeeIdsByNameSearch(term)
    const orParts = [`patrimonio.ilike.%${term}%`, `serial_number.ilike.%${term}%`, `modelo.ilike.%${term}%`]
    if (employeeIds.length) orParts.push(`employee_id.in.(${employeeIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  const from = page * pageSize
  const { data, error, count } = await query
    .order('patrimonio', { ascending: filters.sortDir !== 'desc' })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { data, count: count ?? 0 }
}

export async function getNotebook(id: string) {
  const { data, error } = await supabase.from('notebooks_with_lifecycle').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createNotebook(input: {
  patrimonio: string
  serial_number: string
  modelo: string
  data_aquisicao: string
  garantia_fim?: string | null
  status?: NotebookStatus
  location_id: string
  notes?: string | null
}) {
  const { data, error } = await supabase.from('notebooks').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateNotebook(id: string, input: Partial<{
  patrimonio: string
  serial_number: string
  modelo: string
  data_aquisicao: string
  garantia_fim: string | null
  status: NotebookStatus
  location_id: string
  notes: string | null
}>) {
  const { data, error } = await supabase.from('notebooks').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setNotebookDeactivated(id: string, deactivated: boolean) {
  const { error } = await supabase
    .from('notebooks')
    .update({ deleted_at: deactivated ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function assignNotebook(notebookId: string, employeeId: string, notes?: string) {
  const { data, error } = await supabase.rpc('assign_notebook', {
    p_notebook_id: notebookId,
    p_employee_id: employeeId,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}

export async function unassignNotebook(notebookId: string, notes?: string) {
  const { data, error } = await supabase.rpc('unassign_notebook', {
    p_notebook_id: notebookId,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}
