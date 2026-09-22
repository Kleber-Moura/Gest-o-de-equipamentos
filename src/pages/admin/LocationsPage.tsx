import { ReferenceListAdminPage } from '@/pages/admin/ReferenceListAdminPage'
import { listLocations, createLocation, setLocationActive } from '@/services/referenceData'

export function LocationsPage() {
  return (
    <ReferenceListAdminPage title="Localidades" list={listLocations} create={createLocation} setActive={setLocationActive} />
  )
}
