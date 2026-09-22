import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Laptop,
  Mouse,
  Smartphone,
  UserCheck,
  Users,
  Tags,
  Building2,
  MapPin,
  Radio,
  History,
  Sun,
  Moon,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import type { AppRole } from '@/types/auth'
import { KmMark } from '@/components/branding/KmMark'
import kmLogo from '@/assets/branding/km-logo.jpg'

const ROLE_LABEL: Record<AppRole, string> = { MASTER: 'Master', ADMIN: 'Administrador', USER: 'Usuário' }
const ROLE_BADGE_CLASS: Record<AppRole, string> = { MASTER: 'badge-master', ADMIN: 'badge-admin', USER: 'badge-user' }

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'app-nav-link active' : 'app-nav-link'
}

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon strokeWidth={1.8} />
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const canManage = profile?.role === 'ADMIN' || profile?.role === 'MASTER'
  const isMaster = profile?.role === 'MASTER'

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        {theme === 'dark' ? (
          <img src={kmLogo} alt="KM" className="app-sidebar-logo-img" />
        ) : (
          <KmMark variant="solid" className="app-sidebar-logo" />
        )}
        <nav className="app-nav">
          <NavLink to="/" className={navLinkClass} end>
            <NavIcon icon={LayoutDashboard} /> Dashboard
          </NavLink>
          <NavLink to="/notebooks" className={navLinkClass}>
            <NavIcon icon={Laptop} /> Notebooks
          </NavLink>
          <NavLink to="/acessorios" className={navLinkClass}>
            <NavIcon icon={Mouse} /> Acessórios
          </NavLink>
          <NavLink to="/telefonia" className={navLinkClass}>
            <NavIcon icon={Smartphone} /> Linhas telefônicas
          </NavLink>
          {canManage && (
            <>
              <div className="app-nav-section">Administração</div>
              <NavLink to="/administracao/solicitacoes" className={navLinkClass}>
                <NavIcon icon={UserCheck} /> Solicitações de acesso
              </NavLink>
              <NavLink to="/administracao/colaboradores" className={navLinkClass}>
                <NavIcon icon={Users} /> Colaboradores
              </NavLink>
              <NavLink to="/administracao/categorias" className={navLinkClass}>
                <NavIcon icon={Tags} /> Categorias
              </NavLink>
              <NavLink to="/administracao/departamentos" className={navLinkClass}>
                <NavIcon icon={Building2} /> Departamentos
              </NavLink>
              <NavLink to="/administracao/localidades" className={navLinkClass}>
                <NavIcon icon={MapPin} /> Localidades
              </NavLink>
              <NavLink to="/administracao/operadoras" className={navLinkClass}>
                <NavIcon icon={Radio} /> Operadoras
              </NavLink>
            </>
          )}
          {isMaster && (
            <>
              <div className="app-nav-section">Auditoria</div>
              <NavLink to="/auditoria" className={navLinkClass}>
                <NavIcon icon={History} /> Histórico
              </NavLink>
            </>
          )}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14 }}>{profile.name}</span>
              <span className={`badge ${ROLE_BADGE_CLASS[profile.role]}`}>{ROLE_LABEL[profile.role]}</span>
              <button className="button-link" onClick={() => signOut()}>
                <LogOut size={14} strokeWidth={1.8} /> Sair
              </button>
            </div>
          )}
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
