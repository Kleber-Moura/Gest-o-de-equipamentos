export type AppRole = 'USER' | 'ADMIN' | 'MASTER'
export type ProfileStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED'

export interface AppProfile {
  id: string
  name: string
  email: string
  department_id: string | null
  location_id: string | null
  role: AppRole
  status: ProfileStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}
