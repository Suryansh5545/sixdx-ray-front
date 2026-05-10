import { fetchWithAuth } from '../auth'
import { isValidRoomCode } from './roomCode'

interface CreateRoomResponse {
  room_id?: string
  roomId?: string
  room_name?: string
  roomName?: string
  id?: string
  name?: string
}

function normalizeRoomCode(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase()
  return isValidRoomCode(normalized) ? normalized : null
}

function getCreatedRoomCode(data: CreateRoomResponse): string | null {
  return (
    normalizeRoomCode(data.room_id) ??
    normalizeRoomCode(data.roomId) ??
    normalizeRoomCode(data.room_name) ??
    normalizeRoomCode(data.roomName) ??
    normalizeRoomCode(data.id) ??
    normalizeRoomCode(data.name)
  )
}

export async function createMeetingRoom(): Promise<string> {
  const response = await fetchWithAuth('/livekit/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    throw new Error('Failed to create meeting room')
  }

  const data = (await response.json()) as CreateRoomResponse
  const roomCode = getCreatedRoomCode(data)

  if (!roomCode) {
    throw new Error('Missing room id in create room response')
  }

  return roomCode
}
