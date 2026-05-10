import { buildServerUrl } from './server'

const AUTH_STORAGE_KEY = 'authSession'
const ACCESS_TOKEN_STORAGE_KEY = 'access_token'
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token'
const TOKEN_TYPE_STORAGE_KEY = 'token_type'
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000

export interface AuthUser {
  id: number
  name: string
  email: string
  identifier?: string
  username?: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  refresh_expires_in: number
  user: AuthUser
}

interface RefreshResponse {
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  refresh_expires_in?: number
  user?: AuthUser
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  refreshExpiresIn: number
  accessTokenExpiresAt: number
  refreshTokenExpiresAt: number
  user: AuthUser
}

let refreshInFlight: Promise<AuthSession> | null = null

function getRemainingSeconds(expiresAt: number): number {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
}

function formatTokenType(tokenType: string): string {
  return tokenType.toLowerCase() === 'bearer' ? 'Bearer' : tokenType
}

export function getAuthUserIdentifier(user: AuthUser | null | undefined): string | null {
  if (!user) return null

  return user.identifier?.trim() || user.username?.trim() || user.email?.trim() || null
}

export function createAuthSession(
  response: AuthResponse,
  previousSession?: AuthSession | null,
): AuthSession {
  const accessToken = response.access_token?.trim()
  const refreshToken = response.refresh_token?.trim() ?? previousSession?.refreshToken ?? ''
  const tokenType = response.token_type?.trim() ?? previousSession?.tokenType ?? 'bearer'
  const expiresIn = response.expires_in
  const refreshExpiresIn = response.refresh_expires_in ?? previousSession?.refreshExpiresIn ?? 0
  const user = response.user ?? previousSession?.user

  if (!accessToken || !refreshToken || !tokenType || !expiresIn || !refreshExpiresIn || !user) {
    throw new Error('Invalid authentication response')
  }

  const now = Date.now()

  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresIn,
    refreshExpiresIn,
    accessTokenExpiresAt: now + expiresIn * 1000,
    refreshTokenExpiresAt: now + refreshExpiresIn * 1000,
    user,
  }
}

export function loadStoredAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function persistAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken)
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken)
  localStorage.setItem(TOKEN_TYPE_STORAGE_KEY, session.tokenType)
}

export function clearStoredAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  localStorage.removeItem(TOKEN_TYPE_STORAGE_KEY)
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
}

export function isAccessTokenExpired(session: AuthSession, bufferMs = 0): boolean {
  return session.accessTokenExpiresAt <= Date.now() + bufferMs
}

export function isRefreshTokenExpired(session: AuthSession): boolean {
  return session.refreshTokenExpiresAt <= Date.now()
}

export function getAccessTokenRefreshDelay(session: AuthSession): number {
  return Math.max(0, session.accessTokenExpiresAt - Date.now() - ACCESS_TOKEN_REFRESH_BUFFER_MS)
}

function applyAuthHeader(headers: Headers, session: AuthSession): void {
  headers.set('Authorization', `${formatTokenType(session.tokenType)} ${session.accessToken}`)
}

export async function refreshAuthSession(session: AuthSession): Promise<AuthSession> {
  if (isRefreshTokenExpired(session)) {
    throw new Error('Refresh token expired')
  }

  const response = await fetch(buildServerUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: session.refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh auth session')
  }

  const data = (await response.json()) as RefreshResponse

  return createAuthSession(
    {
      access_token: data.access_token ?? session.accessToken,
      refresh_token: data.refresh_token ?? session.refreshToken,
      token_type: data.token_type ?? session.tokenType,
      expires_in: data.expires_in ?? session.expiresIn,
      refresh_expires_in:
        data.refresh_expires_in ?? getRemainingSeconds(session.refreshTokenExpiresAt),
      user: data.user ?? session.user,
    },
    session,
  )
}

export async function refreshStoredAuthSession(
  session: AuthSession | null = loadStoredAuthSession(),
): Promise<AuthSession | null> {
  if (!session || isRefreshTokenExpired(session)) {
    clearStoredAuthSession()
    return null
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAuthSession(session)
      .then((nextSession) => {
        persistAuthSession(nextSession)
        return nextSession
      })
      .finally(() => {
        refreshInFlight = null
      })
  }

  try {
    return await refreshInFlight
  } catch {
    clearStoredAuthSession()
    return null
  }
}

export async function ensureFreshAuthSession(): Promise<AuthSession | null> {
  const storedSession = loadStoredAuthSession()
  if (!storedSession) return null

  if (!isAccessTokenExpired(storedSession, ACCESS_TOKEN_REFRESH_BUFFER_MS)) {
    return storedSession
  }

  if (isRefreshTokenExpired(storedSession)) {
    clearStoredAuthSession()
    return null
  }

  return refreshStoredAuthSession(storedSession)
}

export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  let session = await ensureFreshAuthSession()

  const headers = new Headers(init.headers)
  if (session) {
    applyAuthHeader(headers, session)
  }

  let response = await fetch(buildServerUrl(path), {
    ...init,
    headers,
  })

  if (response.status !== 401 || !session || isRefreshTokenExpired(session)) {
    return response
  }

  session = await refreshStoredAuthSession(session)
  if (!session) return response

  const retryHeaders = new Headers(init.headers)
  applyAuthHeader(retryHeaders, session)

  response = await fetch(buildServerUrl(path), {
    ...init,
    headers: retryHeaders,
  })

  return response
}
