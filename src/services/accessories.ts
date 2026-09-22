import { supabase } from '@/lib/supabaseClient'
import type { Accessory, AccessoryStatus } from '@/types/domain'
import { employeeIdsByDepartment, employeeIdsByNameSearch, type ListResult } from '@/services/listUtils'

export interface AccessoryFilters {
  status?: AccessoryStatus
  categoryId?: string
  employeeId?: string
  locationId?: string
  departmentId?: string
  search?: string
  /** Direção do clique em "Patrimônio"; sem valor = ordem padrão (por modelo). */
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export async function listAccessories(filters: AccessoryFilters = {}): Promise<ListResult<Accessory>> {
  const { page = 0, pageSize = 20 } = filters
  let query = supabase.from('accessories').select('*', { count: 'exact' }).is('deleted_at', null)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
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
  const orderColumn = filters.sortDir ? 'patrimonio' : 'modelo'
  const { data, error, count } = await query
    .order(orderColumn, { ascending: filters.sortDir !== 'desc' })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { data, count: count ?? 0 }
}

export async function createAccessory(input: {
  patrimonio?: string | null
  serial_number?: string | null
  modelo: string
  category_id: string
  location_id: string
  status?: AccessoryStatus
  notes?: string | null
}) {
  const { data, error } = await supabase.from('accessories').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateAccessory(id: string, input: Partial<Omit<Accessory, 'id'>>) {
  const { data, error } = await supabase.from('accessories').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setAccessoryDeactivated(id: string, deactivated: boolean) {
  const { error } = await supabase
    .from('accessories')
    .update({ deleted_at: deactivated ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function assignAccessory(accessoryId: string, employeeId: string, notes?: string) {
  const { data, error } = await supabase.rpc('assign_accessory', {
    p_accessory_id: accessoryId,
    p_employee_id: employeeId,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}

export async function unassignAccessory(accessoryId: string, notes?: string) {
  const { data, error } = await supabase.rpc('unassign_accessory', {
    p_accessory_id: accessoryId,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}
