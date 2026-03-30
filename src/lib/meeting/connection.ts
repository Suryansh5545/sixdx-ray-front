import { Room, VideoPresets } from 'livekit-client'

export function createRoom(): Room {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
  })
}

export async function connectRoom(room: Room, serverUrl: string, token: string): Promise<void> {
  await room.connect(serverUrl, token)
}

export function disconnectRoom(room: Room): void {
  room.disconnect()
}
