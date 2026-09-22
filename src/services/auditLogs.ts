import { supabase } from '@/lib/supabaseClient'
import type { AuditLog } from '@/types/domain'
import type { ListResult } from '@/services/listUtils'

export async function listAuditLogs(page = 0, pageSize = 30): Promise<ListResult<AuditLog>> {
  const from = page * pageSize
  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { data: data as AuditLog[], count: count ?? 0 }
}

export async function listActorNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('app_profiles').select('id,name')
  if (error) throw error
  return new Map(data.map((p) => [p.id, p.name]))
}
