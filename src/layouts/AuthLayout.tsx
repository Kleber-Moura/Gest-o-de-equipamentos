import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-card">{children}</div>
    </div>
  )
}
