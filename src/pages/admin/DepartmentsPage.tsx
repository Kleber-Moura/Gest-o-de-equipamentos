import { ReferenceListAdminPage } from '@/pages/admin/ReferenceListAdminPage'
import { listDepartments, createDepartment, setDepartmentActive } from '@/services/referenceData'

export function DepartmentsPage() {
  return (
    <ReferenceListAdminPage title="Departamentos" list={listDepartments} create={createDepartment} setActive={setDepartmentActive} />
  )
}
