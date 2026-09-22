import { supabase } from '@/lib/supabaseClient'

export interface ListResult<T> {
  data: T[]
  count: number
}

/** Resolve um filtro de "departamento" em uma lista de employee_id — evita depender
 * da sintaxe de filtro em recurso embutido do PostgREST (mais frágil de acertar) e
 * mantém a consulta principal simples. employees é uma tabela pequena, então esse
 * passo extra é rápido mesmo com a base crescendo bastante. */
export async function employeeIdsByDepartment(departmentId: string): Promise<string[]> {
  const { data, error } = await supabase.from('employees').select('id').eq('department_id', departmentId)
  if (error) throw error
  return data.map((e) => e.id as string)
}

/** Mesma ideia, mas por nome — usada pelas barras de busca de notebooks, acessórios
 * e linhas telefônicas pra também encontrar ativos pelo nome do responsável. */
export async function employeeIdsByNameSearch(term: string): Promise<string[]> {
  const { data, error } = await supabase.from('employees').select('id').ilike('name', `%${term}%`)
  if (error) throw error
  return data.map((e) => e.id as string)
}
