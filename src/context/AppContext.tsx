import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  clearStoredAuthSession,
  ensureFreshAuthSession,
  getAuthUserIdentifier,
  getAccessTokenRefreshDelay,
  isRefreshTokenExpired,
  loadStoredAuthSession,
  persistAuthSession,
  type AuthSession,
} from '../lib/auth'

type PageName = 'landing' | 'organisation' | 'dashboard' | 'meetings' | 'recordings'

interface AppContextValue {
  identifier: string | null
  selectedOrg: string | null
  currentPage: PageName
  authSession: AuthSession | null
  /** whether the last login used the test bypass credentials */
  isTestLogin: boolean
  setIdentifier: (name: string | null) => void
  setSelectedOrg: (org: string | null) => void
  setCurrentPage: (page: PageName) => void
  setIsTestLogin: (flag: boolean) => void
  setAuthSession: (session: AuthSession | null) => void
  logout: () => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

function parseStoredValue<T>(raw: string | null, initial: T): T {
  if (raw === null) return initial

  try {
    return JSON.parse(raw) as T
  } catch {
    return initial
  }
}

function readPersistedValue<T>(key: string, initial: T, legacyKeys: string[] = []): T {
  const keys = [key, ...legacyKeys]

  for (const storage of [localStorage, sessionStorage]) {
    for (const candidate of keys) {
      const raw = storage.getItem(candidate)
      if (raw !== null) {
        return parseStoredValue(raw, initial)
      }
    }
  }

  return initial
}

function clearPersistedKeys(key: string, legacyKeys: string[] = []) {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(key)
    legacyKeys.forEach((legacyKey) => storage.removeItem(legacyKey))
  }
}

function usePersistedState<T>(key: string, initial: T, legacyKeys: string[] = []) {
  const legacyKeysSignature = legacyKeys.join('::')
  const [value, setValue] = useState<T>(() => readPersistedValue(key, initial, legacyKeys))
  const set = useCallback((next: T) => {
    if (next === null || next === undefined) {
      clearPersistedKeys(key, legacyKeys)
    } else {
      localStorage.setItem(key, JSON.stringify(next))
      sessionStorage.removeItem(key)
      legacyKeys.forEach((legacyKey) => {
        localStorage.removeItem(legacyKey)
        sessionStorage.removeItem(legacyKey)
      })
    }
    setValue(next)
  }, [key, legacyKeysSignature])
  return [value, set] as const
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initialAuthSession = loadStoredAuthSession()
  const [identifier, setIdentifier] = usePersistedState<string | null>(
    'identifier',
    getAuthUserIdentifier(initialAuthSession?.user),
    ['username'],
  )
  const [selectedOrg, setSelectedOrg] = usePersistedState<string | null>('selectedOrg', null)
  const [currentPage, setCurrentPage] = useState<PageName>('landing')
  const [isTestLogin, setIsTestLogin] = usePersistedState<boolean>('isTestLogin', false)
  const [authSession, setAuthSessionState] = useState<AuthSession | null>(initialAuthSession)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    clearPersistedKeys('username')
  }, [])

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }, [])

  const logout = useCallback(() => {
    clearRefreshTimer()
    clearStoredAuthSession()
    setAuthSessionState(null)
    setIdentifier(null)
    setSelectedOrg(null)
    setIsTestLogin(false)
  }, [clearRefreshTimer, setIdentifier, setIsTestLogin, setSelectedOrg])

  const setAuthSession = useCallback((session: AuthSession | null) => {
    clearRefreshTimer()

    if (!session) {
      clearStoredAuthSession()
      setAuthSessionState(null)
      setIdentifier(null)
      return
    }

    persistAuthSession(session)
    setAuthSessionState(session)
    setIdentifier(getAuthUserIdentifier(session.user))
    setIsTestLogin(false)
  }, [clearRefreshTimer, setIdentifier, setIsTestLogin])

  useEffect(() => {
    if (!authSession || isTestLogin) {
      clearRefreshTimer()
      return
    }

    const nextIdentifier = getAuthUserIdentifier(authSession.user)
    if (identifier !== nextIdentifier) {
      setIdentifier(nextIdentifier)
    }

    if (isRefreshTokenExpired(authSession)) {
      logout()
      return
    }

    const refreshAfter = getAccessTokenRefreshDelay(authSession)
    refreshTimeoutRef.current = setTimeout(() => {
      ensureFreshAuthSession()
        .then((nextSession) => {
          if (!nextSession) {
            logout()
            return
          }

          setAuthSessionState(nextSession)
          setIdentifier(getAuthUserIdentifier(nextSession.user))
        })
        .catch(() => {
          logout()
        })
    }, refreshAfter)

    return clearRefreshTimer
  }, [authSession, clearRefreshTimer, identifier, isTestLogin, logout, setIdentifier])

  return (
    <AppContext.Provider
      value={{
        identifier,
        selectedOrg,
        currentPage,
        authSession,
        isTestLogin,
        setIdentifier,
        setSelectedOrg,
        setCurrentPage,
        setIsTestLogin,
        setAuthSession,
        logout,
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
