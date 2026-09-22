export type NotebookStatus = 'ASSIGNED' | 'AVAILABLE' | 'BROKEN' | 'MAINTENANCE' | 'RESERVE' | 'DECOMMISSIONED'
export type AccessoryStatus = 'ASSIGNED' | 'AVAILABLE' | 'BROKEN' | 'DECOMMISSIONED' | 'MAINTENANCE'
export type PhoneLineStatus = 'ASSIGNED' | 'AVAILABLE' | 'SUSPENDED' | 'CANCELLED'
export type LifecycleStatus = 'TROCAR' | 'ATENCAO' | 'DENTRO_DA_VIDA_UTIL'

export const NOTEBOOK_STATUS_LABEL: Record<NotebookStatus, string> = {
  ASSIGNED: 'Atribuído',
  AVAILABLE: 'Disponível',
  BROKEN: 'Quebrado',
  MAINTENANCE: 'Manutenção',
  RESERVE: 'Reserva',
  DECOMMISSIONED: 'Desativado',
}

export const ACCESSORY_STATUS_LABEL: Record<AccessoryStatus, string> = {
  ASSIGNED: 'Atribuído',
  AVAILABLE: 'Disponível',
  BROKEN: 'Quebrado',
  DECOMMISSIONED: 'Baixado',
  MAINTENANCE: 'Manutenção',
}

export const PHONE_LINE_STATUS_LABEL: Record<PhoneLineStatus, string> = {
  ASSIGNED: 'Atribuída',
  AVAILABLE: 'Disponível',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
}

export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  TROCAR: 'Troca vencida',
  ATENCAO: 'Atenção para troca',
  DENTRO_DA_VIDA_UTIL: 'Dentro da vida útil',
}

export interface Department {
  id: string
  name: string
  active: boolean
}

export interface Location {
  id: string
  name: string
  code: string | null
  active: boolean
}

export interface AssetCategory {
  id: string
  name: string
  active: boolean
}

export interface Carrier {
  id: string
  name: string
  active: boolean
}

export interface Employee {
  id: string
  name: string
  username: string | null
  email: string | null
  department_id: string | null
  location_id: string | null
  is_shared_asset_holder: boolean
  active: boolean
}

export interface Notebook {
  id: string
  patrimonio: string
  serial_number: string
  modelo: string
  categoria: string
  data_aquisicao: string
  garantia_fim: string | null
  status: NotebookStatus
  employee_id: string | null
  location_id: string
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface NotebookWithLifecycle extends Notebook {
  data_prevista_troca: string
  lifecycle_status: LifecycleStatus
}

export interface Accessory {
  id: string
  patrimonio: string | null
  serial_number: string | null
  modelo: string
  category_id: string
  garantia_fim: string | null
  status: AccessoryStatus
  employee_id: string | null
  location_id: string
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface PhoneLine {
  id: string
  number: string
  carrier_id: string
  assigned_employee_id: string | null
  department_id: string | null
  location_id: string | null
  status: PhoneLineStatus
  chip_type: string | null
  iccid: string | null
  imei: string | null
  eid: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface PhoneInvoice {
  id: string
  phone_line_id: string | null
  raw_number: string
  carrier_id: string
  amount: number
  invoice_date: string
  upload_id: string | null
  created_at: string
}

export type InvoiceUploadStatus = 'PROCESSING' | 'DONE' | 'ERROR'

export const INVOICE_UPLOAD_STATUS_LABEL: Record<InvoiceUploadStatus, string> = {
  PROCESSING: 'Processando',
  DONE: 'Concluído',
  ERROR: 'Erro',
}

export interface InvoiceUpload {
  id: string
  carrier_id: string
  file_name: string
  storage_path: string
  status: InvoiceUploadStatus
  lines_extracted: number | null
  lines_matched: number | null
  error_message: string | null
  uploaded_by: string | null
  created_at: string
  completed_at: string | null
}

export interface AssetMovement {
  id: string
  asset_type: 'notebook' | 'accessory' | 'phone_line'
  asset_id: string
  from_employee_id: string | null
  to_employee_id: string | null
  movement_type: string
  notes: string | null
  changed_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  actor_user_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}
