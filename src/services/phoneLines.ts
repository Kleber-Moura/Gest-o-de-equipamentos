import { supabase } from '@/lib/supabaseClient'
import type { PhoneLine, PhoneLineStatus } from '@/types/domain'
import { employeeIdsByDepartment, employeeIdsByNameSearch, type ListResult } from '@/services/listUtils'

export interface PhoneLineFilters {
  status?: PhoneLineStatus
  carrierId?: string
  employeeId?: string
  departmentId?: string
  locationId?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function listPhoneLines(filters: PhoneLineFilters = {}): Promise<ListResult<PhoneLine>> {
  const { page = 0, pageSize = 20 } = filters
  let query = supabase.from('phone_lines').select('*', { count: 'exact' }).is('deleted_at', null)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.carrierId) query = query.eq('carrier_id', filters.carrierId)
  if (filters.employeeId) query = query.eq('assigned_employee_id', filters.employeeId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.departmentId) {
    const ids = await employeeIdsByDepartment(filters.departmentId)
    query = query.in('assigned_employee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }
  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, '')
    const employeeIds = await employeeIdsByNameSearch(term)
    const orParts = [`number.ilike.%${term}%`]
    if (employeeIds.length) orParts.push(`assigned_employee_id.in.(${employeeIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  const from = page * pageSize
  const { data, error, count } = await query.order('number').range(from, from + pageSize - 1)
  if (error) throw error
  return { data, count: count ?? 0 }
}

export async function createPhoneLine(input: {
  number: string
  carrier_id: string
  department_id?: string | null
  location_id?: string | null
  status?: PhoneLineStatus
  chip_type?: string | null
  iccid?: string | null
  imei?: string | null
  eid?: string | null
  notes?: string | null
}) {
  const { data, error } = await supabase.from('phone_lines').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePhoneLine(id: string, input: Partial<Omit<PhoneLine, 'id'>>) {
  const { data, error } = await supabase.from('phone_lines').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setPhoneLineDeactivated(id: string, deactivated: boolean) {
  const { error } = await supabase
    .from('phone_lines')
    .update({ deleted_at: deactivated ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function assignPhoneLine(phoneLineId: string, employeeId: string, notes?: string) {
  const { data, error } = await supabase.rpc('assign_phone_line', {
    p_phone_line_id: phoneLineId,
    p_employee_id: employeeId,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}

export async function unassignPhoneLine(phoneLineId: string, notes?: string) {
  const { data, error } = await supabase.rpc('unassign_phone_line', {
    p_phone_line_id: phoneLineId,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data
}
