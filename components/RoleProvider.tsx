'use client'
import { createContext, useContext, useState, useEffect } from 'react'

export type Role = 'owner' | 'staff' | null

interface RoleState {
  role: Role
  username: string | null
  displayName: string | null
}

const RoleContext = createContext<RoleState>({
  role: null,
  username: null,
  displayName: null,
})

export function useRole() {
  return useContext(RoleContext)
}

export default function RoleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RoleState>({
    role: null,
    username: null,
    displayName: null,
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setState({
            role: d.role ?? null,
            username: d.username ?? null,
            displayName: d.displayName ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <RoleContext.Provider value={state}>
      {children}
    </RoleContext.Provider>
  )
}
