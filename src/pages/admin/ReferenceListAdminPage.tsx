import { useEffect, useMemo, useState } from 'react'
import { SimpleNameFormModal } from '@/components/SimpleNameFormModal'

interface Item {
  id: string
  name: string
  active: boolean
}

interface Props {
  title: string
  list: () => Promise<Item[]>
  create: (name: string) => Promise<unknown>
  setActive: (id: string, active: boolean) => Promise<void>
}

/** Uma única tela genérica para as 4 listas administráveis (departamentos, localidades,
 * categorias, operadoras) — todas têm exatamente a mesma forma (nome + ativo/inativo).
 * A barra de cima é só busca/filtro; criar é sempre pelo botão "+ Adicionar" → modal,
 * no mesmo padrão de notebooks/acessórios/linhas telefônicas. */
export function ReferenceListAdminPage({ title, list, create, setActive }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      setItems(await list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => item.name.toLowerCase().includes(term))
  }, [items, search])

  return (
    <div>
      <div className="page-header">
        <h2>{title}</h2>
        <button className="button-primary" style={{ width: 'auto' }} onClick={() => setCreating(true)}>
          + Adicionar
        </button>
      </div>

      <div className="filters-bar">
        <input placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Nome</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="empty-state">Carregando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={3} className="empty-state">Nenhum registro encontrado</td></tr>}
            {!loading && filtered.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>
                  <span className={`status-pill ${item.active ? 'status-ok' : 'status-neutral'}`}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <button
                    className="button-small"
                    onClick={() => setActive(item.id, !item.active).then(reload)}
                  >
                    {item.active ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <SimpleNameFormModal
          title={`Novo(a) ${title.toLowerCase()}`}
          create={create}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
