function normalizeBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

const API_SERVER_URL = normalizeBaseUrl(import.meta.env.VITE_SERVER_URL as string | undefined)
const LIVEKIT_SERVER_URL = normalizeBaseUrl(
  import.meta.env.VITE_LIVEKIT_SERVER_URL as string | undefined,
)

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function toWebsocketProtocol(protocol: string): string {
  if (protocol === 'http:') return 'ws:'
  if (protocol === 'https:') return 'wss:'
  return protocol
}

function getWindowBaseUrl(): URL | null {
  if (typeof window === 'undefined' || !window.location.origin) {
    return null
  }

  try {
    return new URL(window.location.origin)
  } catch {
    return null
  }
}

function getReachableBaseUrl(): URL | null {
  const candidates: string[] = []

  const windowBaseUrl = getWindowBaseUrl()

  if (windowBaseUrl) {
    candidates.push(windowBaseUrl.toString())
  }

  if (API_SERVER_URL) {
    candidates.push(API_SERVER_URL)
  }

  const parsed = candidates
    .map((candidate) => {
      try {
        return new URL(candidate)
      } catch {
        return null
      }
    })
    .filter((candidate): candidate is URL => candidate != null)

  return parsed.find((candidate) => !isLoopbackHostname(candidate.hostname)) ?? parsed[0] ?? null
}

export function buildServerUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_SERVER_URL}${normalizedPath}`
}

export function getLivekitServerUrl(): string {
  return LIVEKIT_SERVER_URL
}

export function resolveLivekitServerUrl(value?: string): string {
  const candidate = normalizeBaseUrl(value) || LIVEKIT_SERVER_URL
  if (!candidate) return ''

  try {
    const normalized = new URL(candidate)
    const windowBaseUrl = getWindowBaseUrl()
    const reachableBase = getReachableBaseUrl()

    if (
      reachableBase &&
      isLoopbackHostname(normalized.hostname) &&
      !isLoopbackHostname(reachableBase.hostname)
    ) {
      normalized.hostname = reachableBase.hostname
    }

    normalized.protocol =
      windowBaseUrl?.protocol === 'https:'
        ? 'wss:'
        : toWebsocketProtocol(normalized.protocol)

    return normalized.toString().replace(/\/$/, '')
  } catch {
    return candidate
  }
}
