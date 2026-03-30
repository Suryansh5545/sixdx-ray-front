import { createContext, useContext, useState, type ReactNode } from 'react'

type PageName = 'landing' | 'organisation' | 'meetings' | 'recordings'

interface AppContextValue {
  username: string | null
  selectedOrg: string | null
  currentPage: PageName
  /** whether the last login used the test bypass credentials */
  isTestLogin: boolean
  setUsername: (name: string | null) => void
  setSelectedOrg: (org: string | null) => void
  setCurrentPage: (page: PageName) => void
  setIsTestLogin: (flag: boolean) => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

function usePersistedState<T>(key: string, initial: T) {
  const stored = sessionStorage.getItem(key)
  const [value, setValue] = useState<T>(stored !== null ? (JSON.parse(stored) as T) : initial)
  const set = (next: T) => { sessionStorage.setItem(key, JSON.stringify(next)); setValue(next) }
  return [value, set] as const
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = usePersistedState<string | null>('username', null)
  const [selectedOrg, setSelectedOrg] = usePersistedState<string | null>('selectedOrg', null)
  const [currentPage, setCurrentPage] = useState<PageName>('landing')
  const [isTestLogin, setIsTestLogin] = usePersistedState<boolean>('isTestLogin', false)

  return (
    <AppContext.Provider
      value={{
        username,
        selectedOrg,
        currentPage,
        isTestLogin,
        setUsername,
        setSelectedOrg,
        setCurrentPage,
        setIsTestLogin,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return ctx
}

