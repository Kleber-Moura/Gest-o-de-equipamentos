import { useState } from 'react'
import type { AppProfile } from '@/types/auth'
import { resetUserPassword } from '@/services/adminUsers'
import { PasswordInput } from '@/components/PasswordInput'

interface Props {
  profile: AppProfile
  onClose: () => void
  onDone: () => void
}

export function ResetPasswordModal({ profile, onClose, onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await resetUserPassword(profile.id, password)
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resetar senha')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Resetar senha</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Nova senha para <strong>{profile.name}</strong> ({profile.email}).
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Nova senha</label>
            <PasswordInput value={password} onChange={setPassword} minLength={8} required autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Confirmar nova senha</label>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} minLength={8} required autoComplete="new-password" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>Cancelar</button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Salvando…' : 'Resetar senha'}
          </button>
        </div>
      </div>
    </div>
  )
}
