import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { PasswordInput } from '@/components/PasswordInput'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    setSubmitting(true)
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout>
      <h1>Definir nova senha</h1>
      <p className="auth-subtitle">Escolha uma nova senha para sua conta.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">Nova senha</label>
          <PasswordInput id="password" required minLength={6} autoComplete="new-password" value={password} onChange={setPassword} />
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirmar nova senha</label>
          <PasswordInput
            id="confirmPassword"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
        </div>
        <button className="button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthLayout>
  )
}
