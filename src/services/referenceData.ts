import { supabase } from '@/lib/supabaseClient'
import type { AssetCategory, Carrier, Department, Location } from '@/types/domain'

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('id,name,active').order('name')
  if (error) throw error
  return data
}

export async function listLocations(): Promise<Location[]> {
  const { data, error } = await supabase.from('locations').select('id,name,code,active').order('name')
  if (error) throw error
  return data
}

export async function listCategories(): Promise<AssetCategory[]> {
  const { data, error } = await supabase.from('asset_categories').select('id,name,active').order('name')
  if (error) throw error
  return data
}

export async function listCarriers(): Promise<Carrier[]> {
  const { data, error } = await supabase.from('carriers').select('id,name,active').order('name')
  if (error) throw error
  return data
}

async function createNamed(table: string, name: string) {
  const { data, error } = await supabase.from(table).insert({ name }).select().single()
  if (error) throw error
  return data
}

async function setActive(table: string, id: string, active: boolean) {
  const { error } = await supabase.from(table).update({ active }).eq('id', id)
  if (error) throw error
}

export const createDepartment = (name: string) => createNamed('departments', name)
export const createLocation = (name: string) => createNamed('locations', name)
export const createCategory = (name: string) => createNamed('asset_categories', name)
export const createCarrier = (name: string) => createNamed('carriers', name)

export const setDepartmentActive = (id: string, active: boolean) => setActive('departments', id, active)
export const setLocationActive = (id: string, active: boolean) => setActive('locations', id, active)
export const setCategoryActive = (id: string, active: boolean) => setActive('asset_categories', id, active)
export const setCarrierActive = (id: string, active: boolean) => setActive('carriers', id, active)
