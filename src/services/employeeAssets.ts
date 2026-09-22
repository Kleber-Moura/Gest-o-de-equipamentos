import { supabase } from '@/lib/supabaseClient'
import type { Accessory, Notebook, PhoneLine } from '@/types/domain'

export interface EmployeeAssets {
  notebooks: Notebook[]
  accessories: Accessory[]
  phoneLines: PhoneLine[]
}

/** Consolida tudo que está vinculado a um colaborador — a "busca por colaborador"
 * pedida: notebooks, acessórios e linhas telefônicas, todos com esse employee_id. */
export async function getEmployeeAssets(employeeId: string): Promise<EmployeeAssets> {
  const [notebooks, accessories, phoneLines] = await Promise.all([
    supabase.from('notebooks').select('*').eq('employee_id', employeeId).is('deleted_at', null),
    supabase.from('accessories').select('*').eq('employee_id', employeeId).is('deleted_at', null),
    supabase.from('phone_lines').select('*').eq('assigned_employee_id', employeeId).is('deleted_at', null),
  ])

  if (notebooks.error) throw notebooks.error
  if (accessories.error) throw accessories.error
  if (phoneLines.error) throw phoneLines.error

  return {
    notebooks: notebooks.data as Notebook[],
    accessories: accessories.data as Accessory[],
    phoneLines: phoneLines.data as PhoneLine[],
  }
}
