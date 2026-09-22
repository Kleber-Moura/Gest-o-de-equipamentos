import { ReferenceListAdminPage } from '@/pages/admin/ReferenceListAdminPage'
import { listCategories, createCategory, setCategoryActive } from '@/services/referenceData'

export function CategoriesPage() {
  return (
    <ReferenceListAdminPage title="Categorias de acessório" list={listCategories} create={createCategory} setActive={setCategoryActive} />
  )
}
