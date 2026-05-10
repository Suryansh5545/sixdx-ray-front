const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i

export function generateRoomCode(): string {
  const segments = Array.from({ length: 3 }, () =>
    Array.from(
      { length: 3 },
      () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)],
    ).join(''),
  )

  return segments.join('-')
}

export function isValidRoomCode(value: string | null | undefined): value is string {
  return value != null && ROOM_CODE_REGEX.test(value)
}

export function formatRoomCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9)

  if (clean.length <= 3) return clean
  if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`
}
