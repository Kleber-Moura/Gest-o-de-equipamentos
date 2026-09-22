import { ReferenceListAdminPage } from '@/pages/admin/ReferenceListAdminPage'
import { listCarriers, createCarrier, setCarrierActive } from '@/services/referenceData'

export function CarriersPage() {
  return (
    <ReferenceListAdminPage title="Operadoras" list={listCarriers} create={createCarrier} setActive={setCarrierActive} />
  )
}
