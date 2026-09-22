import { Routes, Route } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotebooksPage } from '@/pages/NotebooksPage'
import { AccessoriesPage } from '@/pages/AccessoriesPage'
import { PhoneLinesPage } from '@/pages/PhoneLinesPage'
import { AccessRequestsPage } from '@/pages/admin/AccessRequestsPage'
import { EmployeesPage } from '@/pages/admin/EmployeesPage'
import { CategoriesPage } from '@/pages/admin/CategoriesPage'
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage'
import { LocationsPage } from '@/pages/admin/LocationsPage'
import { CarriersPage } from '@/pages/admin/CarriersPage'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/cadastro" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
      <Route path="/esqueci-senha" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
      {/* Redefinir senha usa uma sessão temporária de recuperação — não passa pelo PublicOnlyRoute. */}
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/notebooks" element={<NotebooksPage />} />
        <Route path="/acessorios" element={<AccessoriesPage />} />
        <Route path="/telefonia" element={<PhoneLinesPage />} />
        <Route path="/administracao/solicitacoes" element={<AccessRequestsPage />} />
        <Route path="/administracao/colaboradores" element={<EmployeesPage />} />
        <Route path="/administracao/categorias" element={<CategoriesPage />} />
        <Route path="/administracao/departamentos" element={<DepartmentsPage />} />
        <Route path="/administracao/localidades" element={<LocationsPage />} />
        <Route path="/administracao/operadoras" element={<CarriersPage />} />
        <Route path="/auditoria" element={<AuditLogPage />} />
      </Route>
    </Routes>
  )
}
