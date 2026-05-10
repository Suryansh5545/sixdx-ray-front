import { fetchWithAuth } from './auth'

export type RecordingRoot = 'livekit_recordings' | 'hse_safety_audit'

export const DEFAULT_RECORDING_ANALYSIS_CLASSES = ['no_helmet', 'no_vest', 'no_mask'] as const

interface RawRecordingListItem {
  id: number
  recording_root: RecordingRoot
  room_type: string | null
  room_id: string
  folder_name: string
  storage_bucket: string | null
  path_prefix: string | null
  auto_track_egress_enabled: boolean
  room_composite_egress_enabled: boolean
  track_recording_template: string | null
  composite_recording_template: string | null
  created_by_user_id: number
  created_at: string
}

interface RawRecordingListResponse {
  recording_root: RecordingRoot
  room_id: string | null
  folder_name: string | null
  count: number
  total: number
  limit: number
  offset: number
  items: RawRecordingListItem[]
}

export interface RecordingListItem {
  id: number
  recordingRoot: RecordingRoot
  roomType: string | null
  roomId: string
  folderName: string
  storageBucket: string | null
  pathPrefix: string | null
  autoTrackEgressEnabled: boolean
  roomCompositeEgressEnabled: boolean
  trackRecordingTemplate: string | null
  compositeRecordingTemplate: string | null
  createdByUserId: number
  createdAt: string
}

export interface RecordingListResponse {
  recordingRoot: RecordingRoot
  roomId: string | null
  folderName: string | null
  count: number
  total: number
  limit: number
  offset: number
  items: RecordingListItem[]
}

export interface DownloadedRecordingFile {
  blob: Blob
  filename: string
  contentType: string
}

interface RawRecordingAnalyzeResponse {
  recording_detail_id: number
  room_id: string
  folder_name: string
  recording_root: RecordingRoot
  selected_key: string
  local_source_url: string
  job: Record<string, unknown> | null
}

export interface RecordingAnalyzeResponse {
  recordingDetailId: number
  roomId: string
  folderName: string
  recordingRoot: RecordingRoot
  selectedKey: string
  localSourceUrl: string
  job: Record<string, unknown> | null
}

function mapRecordingListItem(item: RawRecordingListItem): RecordingListItem {
  return {
    id: item.id,
    recordingRoot: item.recording_root,
    roomType: item.room_type,
    roomId: item.room_id,
    folderName: item.folder_name,
    storageBucket: item.storage_bucket,
    pathPrefix: item.path_prefix,
    autoTrackEgressEnabled: item.auto_track_egress_enabled,
    roomCompositeEgressEnabled: item.room_composite_egress_enabled,
    trackRecordingTemplate: item.track_recording_template,
    compositeRecordingTemplate: item.composite_recording_template,
    createdByUserId: item.created_by_user_id,
    createdAt: item.created_at,
  }
}

function extractFilenameFromDisposition(value: string | null, fallback: string): string {
  if (!value) return fallback

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const basicMatch = value.match(/filename="?([^"]+)"?/i)
  return basicMatch?.[1] ?? fallback
}

async function readErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail
    }
  } catch {
    // Ignore parse failures and use the fallback.
  }

  return fallback
}

function mapRecordingAnalyzeResponse(data: RawRecordingAnalyzeResponse): RecordingAnalyzeResponse {
  return {
    recordingDetailId: data.recording_detail_id,
    roomId: data.room_id,
    folderName: data.folder_name,
    recordingRoot: data.recording_root,
    selectedKey: data.selected_key,
    localSourceUrl: data.local_source_url,
    job: data.job,
  }
}

export async function listRecordings(params: {
  recordingRoot: RecordingRoot
  roomId?: string
  folderName?: string
  limit?: number
  offset?: number
}): Promise<RecordingListResponse> {
  const searchParams = new URLSearchParams({
    recording_root: params.recordingRoot,
    limit: String(params.limit ?? 100),
    offset: String(params.offset ?? 0),
  })

  if (params.roomId?.trim()) {
    searchParams.set('room_id', params.roomId.trim().toUpperCase())
  }
  if (params.folderName?.trim()) {
    searchParams.set('folder_name', params.folderName.trim())
  }

  const response = await fetchWithAuth(`/recordings/list?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to load recordings.'))
  }

  const data = (await response.json()) as RawRecordingListResponse
  return {
    recordingRoot: data.recording_root,
    roomId: data.room_id,
    folderName: data.folder_name,
    count: data.count,
    total: data.total,
    limit: data.limit,
    offset: data.offset,
    items: Array.isArray(data.items) ? data.items.map(mapRecordingListItem) : [],
  }
}

export async function downloadRecordingFile(
  recordingId: number,
  params: { folderName: string; filename?: string },
): Promise<DownloadedRecordingFile> {
  const searchParams = new URLSearchParams({
    folder_name: params.folderName.trim(),
  })

  if (params.filename?.trim()) {
    searchParams.set('filename', params.filename.trim())
  }

  const fallbackFilename = params.filename?.trim() || `${params.folderName.trim()}.mp4`
  const response = await fetchWithAuth(`/recordings/${recordingId}/download?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to download recording.'))
  }

  return {
    blob: await response.blob(),
    filename: extractFilenameFromDisposition(
      response.headers.get('Content-Disposition'),
      fallbackFilename,
    ),
    contentType: response.headers.get('Content-Type') || 'application/octet-stream',
  }
}

export async function analyzeRecording(
  recordingId: number,
  payload: {
    folderName: string
    filename?: string
    classes?: readonly string[]
    jobId?: string
    sourceName?: string
  },
): Promise<RecordingAnalyzeResponse> {
  const response = await fetchWithAuth(`/recordings/${recordingId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folder_name: payload.folderName.trim(),
      filename: payload.filename?.trim() || undefined,
      classes: [...(payload.classes ?? DEFAULT_RECORDING_ANALYSIS_CLASSES)],
      job_id: payload.jobId,
      source_name: payload.sourceName,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to start recording analysis.'))
  }

  return mapRecordingAnalyzeResponse((await response.json()) as RawRecordingAnalyzeResponse)
}

export function getRecordingAnalysisJobId(result: RecordingAnalyzeResponse): string | null {
  const candidate = result.job?.job_id
  return typeof candidate === 'string' && candidate.trim() ? candidate : null
}
