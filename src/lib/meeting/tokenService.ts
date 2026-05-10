import { fetchWithAuth } from '../auth'
import { resolveLivekitServerUrl } from '../server'

export interface TokenResult {
  token: string
  serverUrl: string
}

interface TokenApiResponse {
  token?: string
  participantToken?: string
  participant_token?: string
  serverUrl?: string
  server_url?: string
}

export async function fetchToken(roomId: string, identity: string): Promise<TokenResult> {
  const encodedRoomId = encodeURIComponent(roomId)

  const response = await fetchWithAuth(`/livekit/rooms/${encodedRoomId}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identity,
      participantName: identity,
      participant_name: identity,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch meeting token')
  }

  const data = (await response.json()) as TokenApiResponse
  const token = data.token ?? data.participantToken ?? data.participant_token
  const serverUrl = resolveLivekitServerUrl(data.serverUrl ?? data.server_url)

  if (!token || !serverUrl) {
    throw new Error('Missing meeting token or server URL')
  }

  return { token, serverUrl }
}
