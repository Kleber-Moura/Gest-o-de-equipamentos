import { useEffect, useState } from 'react'
import { listCategories, listCarriers, listDepartments, listLocations } from '@/services/referenceData'
import { listEmployees } from '@/services/employees'
import type { AssetCategory, Carrier, Department, Employee, Location } from '@/types/domain'

export interface ReferenceData {
  departments: Department[]
  locations: Location[]
  categories: AssetCategory[]
  carriers: Carrier[]
  employees: Employee[]
  employeeName: (id: string | null) => string
  departmentName: (id: string | null) => string
  locationName: (id: string | null) => string
  categoryName: (id: string | null) => string
  carrierName: (id: string | null) => string
  loading: boolean
  reload: () => void
}

/** Carrega uma vez as listas de apoio (departamentos, localidades, categorias,
 * operadoras, colaboradores) usadas em filtros e formulários por praticamente
 * todas as telas — evita repetir a mesma busca em cada página. */
export function useReferenceData(): ReferenceData {
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listDepartments(), listLocations(), listCategories(), listCarriers(), listEmployees()]).then(
      ([d, l, c, ca, e]) => {
        if (!active) return
        setDepartments(d)
        setLocations(l)
        setCategories(c)
        setCarriers(ca)
        setEmployees(e)
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [version])

  const byId = <T extends { id: string; name: string }>(list: T[]) => {
    const map = new Map(list.map((item) => [item.id, item.name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }

  return {
    departments,
    locations,
    categories,
    carriers,
    employees,
    employeeName: byId(employees),
    departmentName: byId(departments),
    locationName: byId(locations),
    categoryName: byId(categories),
    carrierName: byId(carriers),
    loading,
    reload: () => setVersion((v) => v + 1),
  }
}
