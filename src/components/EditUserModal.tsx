import { useState } from 'react'
import type { Department, Location } from '@/types/domain'
import type { AppProfile } from '@/types/auth'
import { updateUserProfile } from '@/services/adminUsers'

interface Props {
  profile: AppProfile
  departments: Department[]
  locations: Location[]
  onClose: () => void
  onSaved: () => void
}

export function EditUserModal({ profile, departments, locations, onClose, onSaved }: Props) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [departmentId, setDepartmentId] = useState(profile.department_id ?? '')
  const [locationId, setLocationId] = useState(profile.location_id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      setError('Nome e e-mail são obrigatórios.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await updateUserProfile({
        user_id: profile.id,
        name: name.trim(),
        email: email.trim(),
        department_id: departmentId || null,
        location_id: locationId || null,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Editar usuário</h2>
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
            <label>Departamento</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Nenhum</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Localidade</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Nenhuma</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          Trocar o e-mail aqui também atualiza o login do usuário no Supabase Auth. O perfil de
          acesso (Usuário/Administrador/Master) é alterado na lista, não aqui.
        </p>
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>Cancelar</button>
          <button className="button-primary" style={{ width: 'auto' }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
