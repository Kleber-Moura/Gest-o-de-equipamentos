import { supabase } from '@/lib/supabaseClient'
import type { Employee } from '@/types/domain'

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id,name,username,email,department_id,location_id,is_shared_asset_holder,active')
    .order('name')
  if (error) throw error
  return data
}

export async function createEmployee(input: {
  name: string
  username?: string | null
  email?: string | null
  department_id?: string | null
  location_id?: string | null
}) {
  const { data, error } = await supabase.from('employees').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateEmployee(id: string, input: Partial<Omit<Employee, 'id'>>) {
  const { data, error } = await supabase.from('employees').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function setEmployeeActive(id: string, active: boolean) {
  const { error } = await supabase.from('employees').update({ active }).eq('id', id)
  if (error) throw error
}

/** Desativa o colaborador E libera (AVAILABLE) os notebooks/acessórios dele, sem
 * remover o vínculo — feito via RPC para ser atômico (ver migration
 * 20260812130000_deactivate_employee_releases_equipment). */
export async function deactivateEmployee(id: string) {
  const { error } = await supabase.rpc('deactivate_employee', { p_employee_id: id })
  if (error) throw error
}
