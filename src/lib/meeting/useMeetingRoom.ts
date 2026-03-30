import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ConnectionState,
  RemoteAudioTrack,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client'
import type { Participant } from '../../components/video/VideoTile'
import { fetchToken } from './tokenService'
import { createRoom, connectRoom, disconnectRoom } from './connection'
import { attachRoomEvents, type MeetingParticipant } from './roomEvents'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeetingError = 'token' | 'connection' | 'media' | 'disconnected' | null

export interface MeetingState {
  /** Remote participants converted to the app's Participant type for VideoGrid */
  participants: Participant[]
  connectionState: ConnectionState
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  error: MeetingError
  /** Local camera stream — set as srcObject on the local VideoTile */
  localVideoStream: MediaStream | null
  /** Local microphone stream — used by the audio level analyser */
  localAudioStream: MediaStream | null
  /** Local screen share stream — passed to the ScreenShare component */
  screenShareStream: MediaStream | null
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  disconnect: () => void
}

// ─── Conversion ───────────────────────────────────────────────────────────────

function toParticipant(mp: MeetingParticipant): Participant {
  return {
    id: mp.identity,
    name: mp.identity,
    stream: mp.videoStream,
    screenShareStream: mp.screenShareStream,
    isMuted: mp.isMuted,
    isCameraOff: mp.isCameraOff,
    isScreenSharing: mp.screenShareStream != null,
    connectionQuality: mp.connectionQuality,
    isLocal: false,
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMeetingRoom(roomId: string, identity: string): MeetingState {
  const roomRef = useRef<Room | null>(null)
  const audioEls = useRef<HTMLAudioElement[]>([])

  const [remoteParticipants, setRemoteParticipants] = useState<MeetingParticipant[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  )
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [error, setError] = useState<MeetingError>(null)
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null)
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null)
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    let dismounted = false
    const room = createRoom()
    roomRef.current = room
    let detachEvents: (() => void) | null = null

    // ── Audio element management ──────────────────────────────────────────────
    function onAudioSubscribed(track: RemoteTrack) {
      if (track.kind !== Track.Kind.Audio) return
      const el = (track as RemoteAudioTrack).attach() as HTMLAudioElement
      el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;'
      document.body.appendChild(el)
      audioEls.current.push(el)
    }

    function onAudioUnsubscribed(track: RemoteTrack) {
      if (track.kind !== Track.Kind.Audio) return
      const removed = (track as RemoteAudioTrack).detach()
      removed.forEach((el) => el.remove())
      audioEls.current = audioEls.current.filter((el) => !removed.includes(el))
    }

    room.on(RoomEvent.TrackSubscribed, onAudioSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onAudioUnsubscribed)

    // ── Connection flow ───────────────────────────────────────────────────────
    async function join() {
      let token: string
      let serverUrl: string
      try {
        ;({ token, serverUrl } = await fetchToken(roomId, identity))
      } catch {
        if (!dismounted) setError('token')
        return
      }

      try {
        await connectRoom(room, serverUrl, token)
      } catch {
        if (!dismounted) setError('connection')
        return
      }

      if (dismounted) {
        disconnectRoom(room)
        return
      }

      try {
        await room.localParticipant.enableCameraAndMicrophone()
      } catch {
        if (!dismounted) setError('media')
        // Don't abort — participant can still join without media
      }

      if (dismounted) return

      // Capture initial local streams
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
      const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone)

      if (camPub?.track) {
        setLocalVideoStream(new MediaStream([camPub.track.mediaStreamTrack]))
      }
      if (micPub?.track) {
        setLocalAudioStream(new MediaStream([micPub.track.mediaStreamTrack]))
      }

      detachEvents = attachRoomEvents(
        room,
        (participants) => { if (!dismounted) setRemoteParticipants(participants) },
        (state) => {
          if (!dismounted) {
            setConnectionState(state)
            if (state === ConnectionState.Disconnected) setError('disconnected')
          }
        },
      )
    }

    join()

    return () => {
      dismounted = true
      room.off(RoomEvent.TrackSubscribed, onAudioSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onAudioUnsubscribed)
      audioEls.current.forEach((el) => el.remove())
      audioEls.current = []
      detachEvents?.()
      disconnectRoom(room)
      roomRef.current = null
    }
  // roomId and identity are stable across the meeting session; re-mounting on
  // change is the correct behavior (join a different room).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, identity])

  // ── Toggle handlers ───────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    // setMicrophoneEnabled(true) = enable/unmute; pass current isMuted to enable when muted
    await room.localParticipant.setMicrophoneEnabled(isMuted)
    setIsMuted((m) => !m)
  }, [isMuted])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const pub = await room.localParticipant.setCameraEnabled(isCameraOff)
    setIsCameraOff((c) => !c)
    const track = pub?.track
    setLocalVideoStream(track ? new MediaStream([track.mediaStreamTrack]) : null)
  }, [isCameraOff])

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      const pub = await room.localParticipant.setScreenShareEnabled(!isScreenSharing)
      const track = pub?.track
      if (track) {
        setScreenShareStream(new MediaStream([track.mediaStreamTrack]))
        setIsScreenSharing(true)
      } else {
        setScreenShareStream(null)
        setIsScreenSharing(false)
      }
    } catch {
      // User cancelled screen share picker — no state change needed
    }
  }, [isScreenSharing])

  const disconnect = useCallback(() => {
    const room = roomRef.current
    if (room) disconnectRoom(room)
  }, [])

  return {
    participants: remoteParticipants.map(toParticipant),
    connectionState,
    isMuted,
    isCameraOff,
    isScreenSharing,
    error,
    localVideoStream,
    localAudioStream,
    screenShareStream,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    disconnect,
  }
}
