import { supabase } from '@/lib/supabaseClient'
import type { AppProfile, AppRole } from '@/types/auth'

export async function listAllProfiles(): Promise<AppProfile[]> {
  const { data, error } = await supabase.from('app_profiles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as AppProfile[]
}

export async function approveUser(userId: string) {
  const { error } = await supabase.rpc('approve_user', { p_user_id: userId })
  if (error) throw error
}

export async function rejectUser(userId: string) {
  const { error } = await supabase.rpc('reject_user', { p_user_id: userId })
  if (error) throw error
}

export async function blockUser(userId: string) {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId })
  if (error) throw error
}

export async function changeUserRole(userId: string, role: AppRole) {
  const { error } = await supabase.rpc('change_user_role', { p_user_id: userId, p_new_role: role })
  if (error) throw error
}
