import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { PasswordInput } from '@/components/PasswordInput'

export function SignupPage() {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'confirm-email' | 'pending' | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error, needsEmailConfirmation } = await signUp(name, email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setResult(needsEmailConfirmation ? 'confirm-email' : 'pending')
  }

  if (result === 'confirm-email') {
    return (
      <AuthLayout>
        <h1>Confirme seu e-mail</h1>
        <p className="auth-subtitle">
          Enviamos um link de confirmação para {email}. Depois de confirmar, sua solicitação de
          acesso ficará disponível para aprovação.
        </p>
        <Link to="/login">Voltar para o login</Link>
      </AuthLayout>
    )
  }

  if (result === 'pending') {
    return (
      <AuthLayout>
        <h1>Cadastro realizado</h1>
        <p className="auth-subtitle">
          Sua solicitação de acesso foi registrada e está pendente de aprovação. Você será
          notificado quando um administrador liberar seu acesso.
        </p>
        <Link to="/login">Voltar para o login</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1>Solicitar acesso</h1>
      <p className="auth-subtitle">Seu cadastro ficará pendente até um administrador aprovar.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Nome completo</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <PasswordInput id="password" required minLength={6} autoComplete="new-password" value={password} onChange={setPassword} />
        </div>
        <button className="button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Solicitar acesso'}
        </button>
      </form>

      <div className="auth-footer">
        Já tem conta? <Link to="/login">Entrar</Link>
      </div>
    </AuthLayout>
  )
}
