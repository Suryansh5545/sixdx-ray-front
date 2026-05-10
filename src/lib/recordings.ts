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
  analysis_job: RawRecordingAnalysisJob
  recording_detail_id: number
  room_id: string
  folder_name: string
  recording_root: RecordingRoot
  message: string
}

export interface RecordingAnalyzeResponse {
  analysisJob: RecordingAnalysisJob
  recordingDetailId: number
  roomId: string
  folderName: string
  recordingRoot: RecordingRoot
  message: string
}

interface RawRecordingAnalysisJob {
  id: number
  job_id: string
  recording_detail_id: number
  created_by_user_id: number
  status: string
  requested_classes: string[]
  selected_object_key: string | null
  local_source_url: string | null
  source_name: string | null
  sub_jobs: Record<string, unknown> | null
  aggregate_result: Record<string, unknown> | null
  last_error: string | null
  created_at: string
  completed_at: string | null
}

export interface RecordingAnalysisJob {
  id: number
  jobId: string
  recordingDetailId: number
  createdByUserId: number
  status: string
  requestedClasses: string[]
  selectedObjectKey: string | null
  localSourceUrl: string | null
  sourceName: string | null
  subJobs: Record<string, unknown> | null
  aggregateResult: Record<string, unknown> | null
  lastError: string | null
  createdAt: string
  completedAt: string | null
}

interface RawAiClassesResponse {
  model_path: string | null
  model_classes: string[] | null
  supported_detection_labels: string[]
}

export interface AiClassesResponse {
  modelPath: string | null
  modelClasses: string[]
  supportedDetectionLabels: string[]
}

interface RawDetectorJobStatus {
  job_id?: string
  state?: string
  source_url?: string | null
  source_name?: string | null
  started_at?: string | null
  stopped_at?: string | null
  last_frame_at?: string | null
  frames_processed?: number
  events_written?: number
  last_error?: string | null
  stop_reason?: string | null
}

export interface DetectorJobStatus {
  jobId: string
  state: string | null
  sourceUrl: string | null
  sourceName: string | null
  startedAt: string | null
  stoppedAt: string | null
  lastFrameAt: string | null
  framesProcessed: number | null
  eventsWritten: number | null
  lastError: string | null
  stopReason: string | null
}

interface RawJobsStatusResponse {
  include_completed: boolean
  detector_jobs: RawDetectorJobStatus[]
  recording_analysis_jobs: RawRecordingAnalysisJob[]
  counts: {
    detector_jobs: number
    recording_analysis_jobs: number
  }
}

export interface JobsStatusResponse {
  includeCompleted: boolean
  detectorJobs: DetectorJobStatus[]
  recordingAnalysisJobs: RecordingAnalysisJob[]
  counts: {
    detectorJobs: number
    recordingAnalysisJobs: number
  }
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

function mapRecordingAnalysisJob(job: RawRecordingAnalysisJob): RecordingAnalysisJob {
  return {
    id: job.id,
    jobId: job.job_id,
    recordingDetailId: job.recording_detail_id,
    createdByUserId: job.created_by_user_id,
    status: job.status,
    requestedClasses: Array.isArray(job.requested_classes) ? job.requested_classes : [],
    selectedObjectKey: job.selected_object_key,
    localSourceUrl: job.local_source_url,
    sourceName: job.source_name,
    subJobs: job.sub_jobs,
    aggregateResult: job.aggregate_result,
    lastError: job.last_error,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  }
}

function mapAiClassesResponse(data: RawAiClassesResponse): AiClassesResponse {
  return {
    modelPath: data.model_path,
    modelClasses: Array.isArray(data.model_classes) ? data.model_classes : [],
    supportedDetectionLabels: Array.isArray(data.supported_detection_labels)
      ? data.supported_detection_labels
      : [],
  }
}

function mapDetectorJobStatus(job: RawDetectorJobStatus): DetectorJobStatus {
  return {
    jobId: typeof job.job_id === 'string' ? job.job_id : '',
    state: typeof job.state === 'string' ? job.state : null,
    sourceUrl: typeof job.source_url === 'string' ? job.source_url : null,
    sourceName: typeof job.source_name === 'string' ? job.source_name : null,
    startedAt: typeof job.started_at === 'string' ? job.started_at : null,
    stoppedAt: typeof job.stopped_at === 'string' ? job.stopped_at : null,
    lastFrameAt: typeof job.last_frame_at === 'string' ? job.last_frame_at : null,
    framesProcessed: typeof job.frames_processed === 'number' ? job.frames_processed : null,
    eventsWritten: typeof job.events_written === 'number' ? job.events_written : null,
    lastError: typeof job.last_error === 'string' ? job.last_error : null,
    stopReason: typeof job.stop_reason === 'string' ? job.stop_reason : null,
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
    analysisJob: mapRecordingAnalysisJob(data.analysis_job),
    recordingDetailId: data.recording_detail_id,
    roomId: data.room_id,
    folderName: data.folder_name,
    recordingRoot: data.recording_root,
    message: data.message,
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
    classes: readonly string[]
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
      classes: [...payload.classes],
      job_id: payload.jobId,
      source_name: payload.sourceName,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to start recording analysis.'))
  }

  return mapRecordingAnalyzeResponse((await response.json()) as RawRecordingAnalyzeResponse)
}

export async function fetchRecordingAnalysisJob(jobId: string): Promise<RecordingAnalysisJob> {
  const response = await fetchWithAuth(`/recordings/analysis-jobs/${encodeURIComponent(jobId)}`)
  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to load analysis job.'))
  }

  return mapRecordingAnalysisJob((await response.json()) as RawRecordingAnalysisJob)
}

export async function fetchSupportedAiClasses(): Promise<AiClassesResponse> {
  const response = await fetchWithAuth('/ai/classes')
  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to load AI classes.'))
  }

  return mapAiClassesResponse((await response.json()) as RawAiClassesResponse)
}

export async function fetchJobsStatus(includeCompleted = false): Promise<JobsStatusResponse> {
  const searchParams = new URLSearchParams({
    include_completed: includeCompleted ? 'true' : 'false',
  })

  const response = await fetchWithAuth(`/jobs/status?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to load job status.'))
  }

  const data = (await response.json()) as RawJobsStatusResponse
  return {
    includeCompleted: data.include_completed,
    detectorJobs: Array.isArray(data.detector_jobs)
      ? data.detector_jobs.map(mapDetectorJobStatus).filter((job) => job.jobId)
      : [],
    recordingAnalysisJobs: Array.isArray(data.recording_analysis_jobs)
      ? data.recording_analysis_jobs.map(mapRecordingAnalysisJob)
      : [],
    counts: {
      detectorJobs: data.counts?.detector_jobs ?? 0,
      recordingAnalysisJobs: data.counts?.recording_analysis_jobs ?? 0,
    },
  }
}

export async function fetchAiJobPreview(jobId: string): Promise<Blob> {
  const response = await fetchWithAuth(`/ai/jobs/${encodeURIComponent(jobId)}/preview`)
  if (!response.ok) {
    throw new Error(await readErrorDetail(response, 'Failed to load job preview.'))
  }

  return response.blob()
}

export function getRecordingAnalysisJobId(result: RecordingAnalyzeResponse): string | null {
  const candidate = result.analysisJob.jobId
  return candidate.trim() ? candidate : null
}
