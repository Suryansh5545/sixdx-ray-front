import { TokenSource } from 'livekit-client'

const SANDBOX_ID = import.meta.env.VITE_LIVEKIT_SANDBOX_ID as string

export interface TokenResult {
  token: string
  serverUrl: string
}

export async function fetchToken(roomId: string, identity: string): Promise<TokenResult> {
  const { serverUrl, participantToken } = await TokenSource
    .sandboxTokenServer(SANDBOX_ID)
    .fetch({ roomName: roomId, participantName: identity })

  return { token: participantToken, serverUrl }
}
