import { supabase } from '@/lib/supabaseClient'
import type { AppRole } from '@/types/auth'

interface FunctionErrorBody {
  error?: string
}

/** Todas as ações aqui passam pela Edge Function "admin-users", que roda com a
 * SERVICE_ROLE_KEY (nunca exposta ao browser) e confere no servidor que quem
 * chamou é MASTER antes de tocar em auth.users. */
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const parsed = (await context.json()) as FunctionErrorBody
        throw new Error(parsed.error ?? error.message)
      } catch {
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }
  const errorBody = data as FunctionErrorBody
  if (errorBody?.error) throw new Error(errorBody.error)
  return data as T
}

export async function createUser(input: {
  email: string
  password: string
  name: string
  role: AppRole
  department_id?: string | null
  location_id?: string | null
}) {
  return invoke<{ id: string }>({ action: 'create', ...input })
}

export async function resetUserPassword(userId: string, newPassword: string) {
  return invoke<{ ok: true }>({ action: 'reset_password', user_id: userId, new_password: newPassword })
}

export async function updateUserProfile(input: {
  user_id: string
  name: string
  email: string
  department_id?: string | null
  location_id?: string | null
}) {
  return invoke<{ ok: true }>({ action: 'update_profile', ...input })
}

export async function deleteUser(userId: string) {
  return invoke<{ ok: true }>({ action: 'delete', user_id: userId })
}
