import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { PasswordInput } from '@/components/PasswordInput'
import { KmMark } from '@/components/branding/KmMark'
import kmLogo from '@/assets/branding/km-logo.jpg'

export function LoginPage() {
  const { signIn } = useAuth()
  const { theme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <AuthLayout>
      {theme === 'dark' ? (
        <img src={kmLogo} alt="KM" className="auth-logo-hero" />
      ) : (
        <KmMark variant="solid" className="auth-logo" />
      )}
      <h1>Entrar</h1>
      <p className="auth-subtitle">Infraestrutura de TI — KM</p>

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
        <div className="field">
          <label htmlFor="password">Senha</label>
          <PasswordInput id="password" required autoComplete="current-password" value={password} onChange={setPassword} />
        </div>
        <button className="button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="auth-footer">
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
        <br />
        Não tem conta? <Link to="/cadastro">Solicitar acesso</Link>
      </div>
    </AuthLayout>
  )
}
