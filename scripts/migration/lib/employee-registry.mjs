// Reconcilia colaboradores entre as 3 abas. E-mail é a chave mais confiável (só existe
// na aba Linhas de telefone); username extraído de "Nome (username)" é a segunda melhor;
// nome completo exato (case-insensitive) é o último recurso, e fica marcado como
// confiança reduzida no relatório — nunca fundido "no escuro".
export class EmployeeRegistry {
  constructor() {
    this.byUsername = new Map()
    this.byEmail = new Map()
    this.byNameLower = new Map()
    this.employees = []
    this.reviewNotes = []
    this.nextId = 1
  }

  #create(base) {
    const employee = {
      tempId: `emp-${this.nextId++}`,
      name: base.name,
      username: base.username ?? null,
      email: base.email ?? null,
      department: base.department ?? null,
      location: base.location ?? null,
      isSharedAssetHolder: base.isSharedAssetHolder ?? false,
      matchedBy: base.matchedBy,
      sources: [],
    }
    this.employees.push(employee)
    if (employee.username) this.byUsername.set(employee.username, employee)
    if (employee.email) this.byEmail.set(employee.email.toLowerCase(), employee)
    this.byNameLower.set(employee.name.toLowerCase(), employee)
    return employee
  }

  #addSource(employee, sourceSheet, sourceRow) {
    employee.sources.push({ sheet: sourceSheet, row: sourceRow })
  }

  #fillGaps(employee, patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (value != null && employee[key] == null) employee[key] = value
    }
  }

  resolveSharedHolder(label, sourceSheet, sourceRow) {
    const key = label.toLowerCase()
    let employee = this.byNameLower.get(key)
    if (!employee) {
      employee = this.#create({ name: label, isSharedAssetHolder: true, matchedBy: 'shared_holder' })
    }
    this.#addSource(employee, sourceSheet, sourceRow)
    return { employee, reviewRequired: false }
  }

  /** Usado ao processar Linhas de telefone primeiro: cria/enriquece por username + e-mail. */
  resolveWithEmail({ name, username, email, department, location }, sourceSheet, sourceRow) {
    let employee = username ? this.byUsername.get(username) : null
    if (!employee && email) employee = this.byEmail.get(email.toLowerCase())
    if (!employee) {
      employee = this.#create({ name, username, email, department, location, matchedBy: 'username_or_email' })
    } else {
      this.#fillGaps(employee, { username, email, department, location })
      if (username && !this.byUsername.has(username)) this.byUsername.set(username, employee)
      if (email && !this.byEmail.has(email.toLowerCase())) this.byEmail.set(email.toLowerCase(), employee)
    }
    this.#addSource(employee, sourceSheet, sourceRow)
    return { employee, reviewRequired: false }
  }

  /** Usado para Laptop/Acessórios: resolve por username; sem username, tenta nome exato. */
  resolvePerson(parsed, department, location, sourceSheet, sourceRow) {
    if (parsed.kind === 'person') {
      let employee = this.byUsername.get(parsed.username)
      if (!employee) {
        employee = this.byNameLower.get(parsed.name.toLowerCase())
      }
      if (!employee) {
        employee = this.#create({
          name: parsed.name,
          username: parsed.username,
          department,
          location,
          matchedBy: 'username',
        })
      } else {
        this.#fillGaps(employee, { username: parsed.username, department, location })
        this.byUsername.set(parsed.username, employee)
      }
      this.#addSource(employee, sourceSheet, sourceRow)
      return { employee, reviewRequired: false, notes: parsed.notes }
    }

    if (parsed.kind === 'person_no_username') {
      const existing = this.byNameLower.get(parsed.name.toLowerCase())
      if (existing) {
        this.#addSource(existing, sourceSheet, sourceRow)
        return { employee: existing, reviewRequired: false }
      }
      // Nome sem username e sem correspondência exata: cria colaborador de baixa
      // confiança e sinaliza para revisão humana (ex.: "Fabio" isolado).
      const candidates = this.employees
        .filter((e) => !e.isSharedAssetHolder && e.name.toLowerCase().includes(parsed.name.toLowerCase()))
        .map((e) => e.name)
      const created = this.#create({ name: parsed.name, department, location, matchedBy: 'name_only_new' })
      this.#addSource(created, sourceSheet, sourceRow)
      return {
        employee: created,
        reviewRequired: true,
        reason: candidates.length
          ? `Responsável "${parsed.name}" sem username/e-mail; possível correspondência com: ${candidates.join(', ')}`
          : `Responsável "${parsed.name}" sem username/e-mail e sem correspondência conhecida`,
      }
    }

    return { employee: null, reviewRequired: false }
  }
}
