import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import type { AppProfile } from '@/types/auth'

interface AuthResult {
  error: string | null
}

interface SignUpResult extends AuthResult {
  needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  session: Session | null
  profile: AppProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('User already registered')) return 'Já existe uma conta com este e-mail.'
  if (message.includes('Password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from('app_profiles').select('*').eq('id', userId).single()
    if (error) {
      // PGRST116/no rows: o trigger de criação do perfil pode levar um instante após o signUp.
      setProfile(null)
      return
    }
    setProfile(data as AppProfile)
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? translateAuthError(error.message) : null }
  }

  async function signUp(name: string, email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) return { error: translateAuthError(error.message), needsEmailConfirmation: false }
    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function requestPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    return { error: error ? translateAuthError(error.message) : null }
  }

  async function updatePassword(password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error ? translateAuthError(error.message) : null }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}
