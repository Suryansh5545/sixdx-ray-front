import {
  ConnectionQuality,
  ConnectionState,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetingParticipant {
  identity: string
  videoStream: MediaStream | null
  screenShareStream: MediaStream | null
  isMuted: boolean
  isCameraOff: boolean
  connectionQuality: 0 | 1 | 2 | 3
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapQuality(q: ConnectionQuality): 0 | 1 | 2 | 3 {
  if (q === ConnectionQuality.Excellent) return 3
  if (q === ConnectionQuality.Good) return 2
  if (q === ConnectionQuality.Poor) return 1
  return 0
}

// Cache MediaStream per video track to avoid re-triggering DOM srcObject writes
// when the participant list is refreshed without the track changing.
const streamCache = new WeakMap<object, MediaStream>()

function getVideoStream(track: object & { mediaStreamTrack: MediaStreamTrack }): MediaStream {
  const cached = streamCache.get(track)
  if (cached) return cached
  const stream = new MediaStream([track.mediaStreamTrack])
  streamCache.set(track, stream)
  return stream
}

function participantToState(p: RemoteParticipant): MeetingParticipant {
  let videoStream: MediaStream | null = null
  let screenShareStream: MediaStream | null = null
  let isCameraOff = true
  let isMuted = true

  for (const pub of p.videoTrackPublications.values()) {
    if (!pub.isSubscribed || !pub.videoTrack || pub.isMuted) continue
    if (pub.source === Track.Source.ScreenShare) {
      screenShareStream = getVideoStream(pub.videoTrack)
    } else if (pub.source === Track.Source.Camera) {
      videoStream = getVideoStream(pub.videoTrack)
      isCameraOff = false
    }
  }

  for (const pub of p.audioTrackPublications.values()) {
    if (pub.isSubscribed) {
      isMuted = pub.isMuted
      break
    }
  }

  return {
    identity: p.identity,
    videoStream,
    screenShareStream,
    isMuted,
    isCameraOff,
    connectionQuality: mapQuality(p.connectionQuality),
  }
}

function buildSnapshot(room: Room): MeetingParticipant[] {
  return Array.from(room.remoteParticipants.values()).map(participantToState)
}

// ─── Event attachment ─────────────────────────────────────────────────────────

export function attachRoomEvents(
  room: Room,
  onParticipantsChange: (participants: MeetingParticipant[]) => void,
  onConnectionStateChange: (state: ConnectionState) => void,
): () => void {
  const refresh = () => onParticipantsChange(buildSnapshot(room))
  const onConnState = (state: ConnectionState) => onConnectionStateChange(state)

  room.on(RoomEvent.ParticipantConnected, refresh)
  room.on(RoomEvent.ParticipantDisconnected, refresh)
  room.on(RoomEvent.TrackPublished, refresh)
  room.on(RoomEvent.TrackUnpublished, refresh)
  room.on(RoomEvent.TrackSubscribed, refresh)
  room.on(RoomEvent.TrackUnsubscribed, refresh)
  room.on(RoomEvent.TrackMuted, refresh)
  room.on(RoomEvent.TrackUnmuted, refresh)
  room.on(RoomEvent.ConnectionQualityChanged, refresh)
  room.on(RoomEvent.ConnectionStateChanged, onConnState)

  return () => {
    room.off(RoomEvent.ParticipantConnected, refresh)
    room.off(RoomEvent.ParticipantDisconnected, refresh)
    room.off(RoomEvent.TrackPublished, refresh)
    room.off(RoomEvent.TrackUnpublished, refresh)
    room.off(RoomEvent.TrackSubscribed, refresh)
    room.off(RoomEvent.TrackUnsubscribed, refresh)
    room.off(RoomEvent.TrackMuted, refresh)
    room.off(RoomEvent.TrackUnmuted, refresh)
    room.off(RoomEvent.ConnectionQualityChanged, refresh)
    room.off(RoomEvent.ConnectionStateChanged, onConnState)
  }
}
