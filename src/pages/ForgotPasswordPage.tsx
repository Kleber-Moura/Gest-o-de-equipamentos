import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuth } from '@/hooks/useAuth'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await requestPasswordReset(email)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout>
        <h1>Verifique seu e-mail</h1>
        <p className="auth-subtitle">
          Se {email} estiver cadastrado, enviamos um link para redefinir sua senha.
        </p>
        <Link to="/login">Voltar para o login</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1>Esqueci minha senha</h1>
      <p className="auth-subtitle">Enviaremos um link de redefinição para seu e-mail.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
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
        <button className="button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar link de redefinição'}
        </button>
      </form>

      <div className="auth-footer">
        <Link to="/login">Voltar para o login</Link>
      </div>
    </AuthLayout>
  )
}
