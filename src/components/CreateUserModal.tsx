import { useState } from 'react'
import type { Department, Location } from '@/types/domain'
import type { AppRole } from '@/types/auth'
import { createUser } from '@/services/adminUsers'
import { PasswordInput } from '@/components/PasswordInput'

interface Props {
  departments: Department[]
  locations: Location[]
  onClose: () => void
  onCreated: () => void
}

export function CreateUserModal({ departments, locations, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<AppRole>('USER')
  const [departmentId, setDepartmentId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Nome, e-mail e senha são obrigatórios.')
      return
    }
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
      await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        department_id: departmentId || null,
        location_id: locationId || null,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Novo usuário</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Senha inicial</label>
            <PasswordInput value={password} onChange={setPassword} minLength={8} required autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} minLength={8} required autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Perfil de acesso</label>
            <select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
              <option value="USER">Usuário</option>
              <option value="ADMIN">Administrador</option>
              <option value="MASTER">Master</option>
            </select>
          </div>
          <div className="field">
            <label>Departamento (opcional)</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Nenhum</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Localidade (opcional)</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Nenhuma</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          O usuário é criado já aprovado, com as credenciais salvas no Supabase Auth — ele pode entrar
          imediatamente com o e-mail e a senha definidos aqui.
        </p>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>Cancelar</button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Criando…' : 'Criar usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}
