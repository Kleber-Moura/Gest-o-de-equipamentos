import { useState } from 'react'

interface Props {
  title: string
  create: (name: string) => Promise<unknown>
  onClose: () => void
  onSaved: () => void
}

/** Modal de criação para as entidades que só têm "nome" (departamentos, localidades,
 * categorias, operadoras) — mesmo padrão de botão "+ Adicionar" → formulário das
 * telas de notebooks/acessórios/linhas, em vez de um campo solto na barra de busca. */
export function SimpleNameFormModal({ title, create, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Digite um nome.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await create(name.trim())
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </div>
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
