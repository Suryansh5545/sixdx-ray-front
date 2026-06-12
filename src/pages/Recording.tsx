import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { formatRoomCode } from "../lib/meeting/roomCode";
import {
  sendHseViolationEmail,
  type HseViolationEmailResponse,
} from "../lib/notifications";
import {
  analyzeRecording,
  DEFAULT_RECORDING_ANALYSIS_CLASSES,
  deleteRecording,
  downloadRecordingFile,
  fetchJobsStatus,
  fetchRecordingAnalysisJob,
  fetchSupportedAiClasses,
  type DetectorJobStatus,
  type JobsStatusResponse,
  getRecordingAnalysisJobId,
  listRecordings,
  type RecordingAnalysisJob,
  type RecordingListItem,
  type RecordingRoot,
} from "../lib/recordings";

type ActionKind = "preview" | "download" | "analyze" | "delete";

interface BannerState {
  kind: "success" | "error";
  text: string;
}

interface PreviewState {
  recording: RecordingListItem | null;
  url: string | null;
  filename: string | null;
  loading: boolean;
  error: string | null;
}

interface DetectionEvent {
  label: string;
  className: string | null;
  confidence: number | null;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  frame: {
    index: number | null;
    width: number;
    height: number;
  } | null;
  time: {
    detectedAt: string | null;
    sourceTimestampSec: number | null;
  };
}

interface DetectionMoment {
  id: string;
  detectedAt: string;
  sourceTimestampSec: number | null;
  frameWidth: number;
  frameHeight: number;
  events: DetectionEvent[];
}

interface ClassPreviewState {
  job: RecordingAnalysisJob | null;
  recording: RecordingListItem | null;
  label: string | null;
  subJobId: string | null;
  moments: DetectionMoment[];
  selectedMomentIndex: number;
  mediaType: "video" | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  loading: boolean;
  error: string | null;
  note: string | null;
}

interface ClassNotificationState {
  response: HseViolationEmailResponse;
  sentAt: string;
}

interface DeleteDialogState {
  recording: RecordingListItem | null;
  deleteStorageFiles: boolean;
}

const ROOT_OPTIONS: Array<{ value: RecordingRoot; label: string; hint: string }> = [
  {
    value: "livekit_recordings",
    label: "Meetings",
    hint: "Standard LiveKit room recordings",
  },
  {
    value: "hse_safety_audit",
    label: "HSE Audits",
    hint: "Safety-audit recording folders",
  },
];

function formatDate(iso: string): string {
  const date = new Date(iso);
  return (
    date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " - " +
    date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function truncateMiddle(value: string | null, maxLength = 52): string {
  if (!value) return "Not available";
  if (value.length <= maxLength) return value;

  const headLength = Math.max(14, Math.floor((maxLength - 3) / 2));
  const tailLength = Math.max(10, maxLength - headLength - 3);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
}

function roomTypeLabel(value: string | null): string {
  if (!value) return "Room";
  if (value === "hse_safety_audit") return "HSE Audit";
  if (value === "meeting") return "Meeting";
  return value.replace(/_/g, " ");
}

function fileNameFromKey(value: string): string {
  const segments = value.split("/");
  return segments[segments.length - 1] || value;
}

function formatClassLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusTone(status: string | null | undefined) {
  if (status === "completed") {
    return {
      background: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.24)",
      color: "rgba(170,245,195,0.92)",
    };
  }
  if (status === "completed_with_errors" || status === "error" || status === "failed") {
    return {
      background: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.24)",
      color: "rgba(255,170,170,0.92)",
    };
  }
  if (status === "queued" || status === "running" || status === "starting") {
    return {
      background: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.24)",
      color: "rgba(248,212,137,0.92)",
    };
  }
  return {
    background: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.78)",
  };
}

function getSubJobSummaries(job: RecordingAnalysisJob) {
  if (!job.subJobs || typeof job.subJobs !== "object") return [];

  return Object.entries(job.subJobs).map(([label, value]) => {
    const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const nestedStatus =
      item.status && typeof item.status === "object"
        ? (item.status as Record<string, unknown>)
        : null;

    return {
      label,
      jobId: typeof item.job_id === "string" ? item.job_id : null,
      state: nestedStatus && typeof nestedStatus.state === "string" ? nestedStatus.state : null,
      lastError:
        nestedStatus && typeof nestedStatus.last_error === "string"
          ? nestedStatus.last_error
          : null,
    };
  });
}

function getAggregateResultSummary(job: RecordingAnalysisJob): string | null {
  if (!job.aggregateResult || typeof job.aggregateResult !== "object") return null;

  const resultsByClass = (job.aggregateResult as Record<string, unknown>).results_by_class;
  if (!resultsByClass || typeof resultsByClass !== "object") {
    return "Aggregate result saved";
  }

  const totalClasses = Object.keys(resultsByClass as Record<string, unknown>).length;
  return `Aggregate result saved for ${totalClasses} class${totalClasses === 1 ? "" : "es"}`;
}

function getAggregateClassResultEntry(job: RecordingAnalysisJob, label: string) {
  if (!job.aggregateResult || typeof job.aggregateResult !== "object") return null;

  const resultsByClass = (job.aggregateResult as Record<string, unknown>).results_by_class;
  if (!resultsByClass || typeof resultsByClass !== "object") return null;

  const classEntry = (resultsByClass as Record<string, unknown>)[label];
  return classEntry && typeof classEntry === "object"
    ? (classEntry as Record<string, unknown>)
    : null;
}

function parseDetectionEvent(raw: unknown, fallbackDetectedAt: string): DetectionEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown>;
  const bboxValue =
    value.bbox && typeof value.bbox === "object"
      ? (value.bbox as Record<string, unknown>)
      : null;
  const frameValue =
    value.frame && typeof value.frame === "object"
      ? (value.frame as Record<string, unknown>)
      : null;
  const timeValue =
    value.time && typeof value.time === "object"
      ? (value.time as Record<string, unknown>)
      : null;

  const bbox =
    bboxValue &&
    typeof bboxValue.x1 === "number" &&
    typeof bboxValue.y1 === "number" &&
    typeof bboxValue.x2 === "number" &&
    typeof bboxValue.y2 === "number"
      ? {
          x1: bboxValue.x1,
          y1: bboxValue.y1,
          x2: bboxValue.x2,
          y2: bboxValue.y2,
        }
      : null;

  const frame =
    frameValue &&
    typeof frameValue.width === "number" &&
    typeof frameValue.height === "number"
      ? {
          index: typeof frameValue.index === "number" ? frameValue.index : null,
          width: frameValue.width,
          height: frameValue.height,
        }
      : null;

  return {
    label: typeof value.label === "string" ? value.label : "",
    className: typeof value.class_name === "string" ? value.class_name : null,
    confidence: typeof value.confidence === "number" ? value.confidence : null,
    bbox,
    frame,
    time: {
      detectedAt:
        timeValue && typeof timeValue.detected_at === "string"
          ? timeValue.detected_at
          : fallbackDetectedAt,
      sourceTimestampSec:
        timeValue && typeof timeValue.source_timestamp_sec === "number"
          ? timeValue.source_timestamp_sec
          : null,
    },
  };
}

function getClassDetectionMoments(job: RecordingAnalysisJob, label: string): DetectionMoment[] {
  const classEntry = getAggregateClassResultEntry(job, label);
  const result =
    classEntry?.result && typeof classEntry.result === "object"
      ? (classEntry.result as Record<string, unknown>)
      : null;
  const eventsByTime =
    result?.events_by_time && typeof result.events_by_time === "object"
      ? (result.events_by_time as Record<string, unknown>)
      : null;

  if (!eventsByTime) return [];

  return Object.entries(eventsByTime)
    .map(([detectedAt, rawEvents]) => {
      const events = Array.isArray(rawEvents)
        ? rawEvents
            .map((item) => parseDetectionEvent(item, detectedAt))
            .filter((item): item is DetectionEvent => item != null)
        : [];

      const firstFrame = events.find((event) => event.frame != null)?.frame ?? null;
      const sourceTimestampSec =
        events.find((event) => event.time.sourceTimestampSec != null)?.time.sourceTimestampSec ?? null;

      return {
        id: detectedAt,
        detectedAt,
        sourceTimestampSec,
        frameWidth: firstFrame?.width ?? 0,
        frameHeight: firstFrame?.height ?? 0,
        events,
      };
    })
    .filter((moment) => moment.events.length > 0)
    .sort((left, right) => {
      if (left.sourceTimestampSec != null && right.sourceTimestampSec != null) {
        return left.sourceTimestampSec - right.sourceTimestampSec;
      }
      return left.detectedAt.localeCompare(right.detectedAt);
    });
}

function getMomentFrameIndex(moment: DetectionMoment): number | null {
  return moment.events.find((event) => event.frame?.index != null)?.frame?.index ?? null;
}

function extractFolderNameFromSourceName(sourceName: string | null): string | null {
  if (!sourceName) return null;

  const prefix = "recording-";
  if (!sourceName.startsWith(prefix)) return null;

  const folderName = sourceName.slice(prefix.length).trim();
  return folderName.length > 0 ? folderName : null;
}

function extractRoomIdFromText(value: string | null | undefined): string | null {
  if (!value) return null;

  const match = value.toUpperCase().match(/[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}/);
  return match?.[0] ?? null;
}

function getClassNotificationKey(jobId: string, label: string): string {
  return `${jobId}:${label}`;
}

function triggerSignedDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 0);
}

function PreviewModal({
  preview,
  onClose,
  onDownload,
  downloadBusy,
}: {
  preview: PreviewState;
  onClose: () => void;
  onDownload: (recording: RecordingListItem) => void;
  downloadBusy: boolean;
}) {
  const recording = preview.recording;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!recording) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,5,14,0.92)", backdropFilter: "blur(14px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full overflow-hidden rounded-[24px]"
        style={{
          maxWidth: 940,
          background: "linear-gradient(160deg, #081022, #050c1c)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,10,60,0.55)",
        }}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p className="text-white text-base font-medium">{recording.roomId}</p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
              {recording.folderName} - {formatDate(recording.createdAt)}
            </p>
            {preview.filename && (
              <p className="text-xs mt-2" style={{ color: "rgba(79,179,255,0.75)" }}>
                {preview.filename}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(recording)}
              disabled={downloadBusy}
              className="px-3 py-2 rounded-xl text-xs transition-opacity hover:opacity-80"
              style={{
                background: "rgba(30,107,255,0.2)",
                border: "1px solid rgba(79,179,255,0.3)",
                color: "#90caff",
                cursor: downloadBusy ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {downloadBusy ? "Downloading..." : "Download"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-70"
              style={{
                width: 34,
                height: 34,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.65)",
                cursor: "pointer",
              }}
              aria-label="Close preview"
            >
              x
            </button>
          </div>
        </div>

        <div
          className="flex items-center justify-center"
          style={{ background: "#000", aspectRatio: "16/9" }}
        >
          {preview.loading && (
            <div className="flex flex-col items-center gap-4">
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: "2px solid rgba(79,179,255,0.15)",
                  borderTopColor: "#4fb3ff",
                  borderRadius: "50%",
                  animation: "spin 0.85s linear infinite",
                }}
              />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
                Loading preview...
              </p>
            </div>
          )}

          {!preview.loading && preview.error && (
            <div className="max-w-md px-6 text-center">
              <p className="text-sm" style={{ color: "rgba(255,170,170,0.92)" }}>
                {preview.error}
              </p>
            </div>
          )}

          {!preview.loading && !preview.error && preview.url && (
            <video
              src={preview.url}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteRecordingModal({
  state,
  busy,
  onClose,
  onToggleDeleteStorageFiles,
  onConfirm,
}: {
  state: DeleteDialogState;
  busy: boolean;
  onClose: () => void;
  onToggleDeleteStorageFiles: (nextValue: boolean) => void;
  onConfirm: () => void;
}) {
  const recording = state.recording;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  if (!recording) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,5,14,0.92)", backdropFilter: "blur(14px)" }}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg rounded-[24px] p-5"
        style={{
          background: "linear-gradient(160deg, #081022, #050c1c)",
          border: "1px solid rgba(239,68,68,0.2)",
          boxShadow: "0 32px 80px rgba(0,10,60,0.55)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#ff9d9d" }}>
              Delete recording
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">{recording.roomId}</h2>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.46)" }}>
              {recording.folderName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-70"
            style={{
              width: 34,
              height: 34,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.65)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
            aria-label="Close delete dialog"
          >
            x
          </button>
        </div>

        <div
          className="mt-4 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.16)",
            color: "rgba(255,210,210,0.92)",
          }}
        >
          This deletes the saved recording entry and any finished linked analysis jobs. Running or
          queued analysis will block deletion.
        </div>

        <label
          className="mt-4 flex items-start gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={state.deleteStorageFiles}
            disabled={busy}
            onChange={(event) => onToggleDeleteStorageFiles(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm text-white">Also delete stored recording files</span>
            <span className="block mt-1 text-xs" style={{ color: "rgba(255,255,255,0.44)" }}>
              Keep this on to remove the object-storage files too. Clear it if you only want to
              remove the database entry.
            </span>
          </span>
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-2xl text-sm"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.72)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-2xl text-sm"
            style={{
              background: "rgba(239,68,68,0.14)",
              border: "1px solid rgba(239,68,68,0.28)",
              color: "#ffb4b4",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {busy ? "Deleting..." : "Delete recording"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassPreviewModal({
  preview,
  onClose,
  onSelectMoment,
}: {
  preview: ClassPreviewState;
  onClose: () => void;
  onSelectMoment: (index: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const currentMoment =
    preview.selectedMomentIndex >= 0 ? preview.moments[preview.selectedMomentIndex] ?? null : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (
      preview.mediaType !== "video" ||
      !preview.mediaUrl ||
      !currentMoment ||
      !videoRef.current ||
      !canvasRef.current
    ) {
      setFrameLoading(false);
      setFrameError(null);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      setFrameError("Could not prepare a frame canvas for this preview.");
      setFrameLoading(false);
      return;
    }

    const moment = currentMoment;
    const drawingContext = context;
    let cancelled = false;

    setFrameLoading(true);
    setFrameError(null);

    function drawCurrentFrame() {
      if (cancelled) return;

      const width = moment.frameWidth > 0 ? moment.frameWidth : video.videoWidth;
      const height = moment.frameHeight > 0 ? moment.frameHeight : video.videoHeight;

      if (width <= 0 || height <= 0) {
        setFrameError("Frame dimensions were not available for this saved moment.");
        setFrameLoading(false);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      drawingContext.clearRect(0, 0, width, height);
      drawingContext.drawImage(video, 0, 0, width, height);

      moment.events.forEach((event) => {
        if (!event.bbox) return;

        const clampedX1 = Math.min(Math.max(Math.min(event.bbox.x1, event.bbox.x2), 0), width);
        const clampedY1 = Math.min(Math.max(Math.min(event.bbox.y1, event.bbox.y2), 0), height);
        const clampedX2 = Math.min(Math.max(Math.max(event.bbox.x1, event.bbox.x2), 0), width);
        const clampedY2 = Math.min(Math.max(Math.max(event.bbox.y1, event.bbox.y2), 0), height);
        const boxWidth = Math.max(0, clampedX2 - clampedX1);
        const boxHeight = Math.max(0, clampedY2 - clampedY1);

        if (boxWidth === 0 || boxHeight === 0) return;

        drawingContext.fillStyle = "rgba(239,68,68,0.12)";
        drawingContext.strokeStyle = "#ef4444";
        drawingContext.lineWidth = 4;
        drawingContext.fillRect(clampedX1, clampedY1, boxWidth, boxHeight);
        drawingContext.strokeRect(clampedX1, clampedY1, boxWidth, boxHeight);

        const text = `${formatClassLabel(event.label)}${
          event.confidence != null ? ` ${(event.confidence * 100).toFixed(1)}%` : ""
        }`;
        let fontSize = 20;
        drawingContext.font = `600 ${fontSize}px 'DM Sans', sans-serif`;
        drawingContext.textBaseline = "top";
        let textWidth = drawingContext.measureText(text).width + 16;
        const textHeight = 26;

        const maxLabelWidth = Math.max(80, width - 8);
        while (textWidth > maxLabelWidth && fontSize > 12) {
          fontSize -= 1;
          drawingContext.font = `600 ${fontSize}px 'DM Sans', sans-serif`;
          textWidth = drawingContext.measureText(text).width + 16;
        }

        const textX = Math.min(Math.max(clampedX1, 4), Math.max(4, width - textWidth - 4));
        const textY = Math.min(
          Math.max(clampedY1 - textHeight - 6, 4),
          Math.max(4, height - textHeight - 4),
        );

        drawingContext.fillStyle = "rgba(0,0,0,0.72)";
        drawingContext.fillRect(textX, textY, textWidth, textHeight);
        drawingContext.fillStyle = "#ffffff";
        drawingContext.fillText(text, textX + 8, textY + 4);
      });

      setFrameLoading(false);
    }

    function seekToMoment() {
      if (moment.sourceTimestampSec == null) {
        setFrameError(
          "This saved detection does not include a source timestamp, so the frame cannot be reconstructed from the original recording.",
        );
        setFrameLoading(false);
        return;
      }

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const targetTime =
        duration > 0
          ? Math.min(
              Math.max(moment.sourceTimestampSec, 0),
              Math.max(duration - 0.001, 0),
            )
          : Math.max(moment.sourceTimestampSec, 0);

      void video.pause();
      video.currentTime = targetTime;
    }

    function handleSeeked() {
      drawCurrentFrame();
    }

    function handleVideoError() {
      if (cancelled) return;
      setFrameError("Failed to decode the selected moment from the source recording.");
      setFrameLoading(false);
    }

    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleVideoError);

    if (video.readyState >= 1) {
      seekToMoment();
    } else {
      video.addEventListener("loadedmetadata", seekToMoment, { once: true });
    }

    return () => {
      cancelled = true;
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("loadedmetadata", seekToMoment);
    };
  }, [currentMoment, preview.mediaType, preview.mediaUrl]);

  if (!preview.job || !preview.label) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,5,14,0.94)", backdropFilter: "blur(14px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full overflow-hidden rounded-[24px]"
        style={{
          maxWidth: 1080,
          background: "linear-gradient(160deg, #081022, #050c1c)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,10,60,0.55)",
        }}
      >
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p className="text-white text-base font-medium">
              {formatClassLabel(preview.label)} preview
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
              Parent job {preview.job.jobId}
            </p>
            {preview.mediaFilename && (
              <p className="text-xs mt-2" style={{ color: "rgba(79,179,255,0.75)" }}>
                {preview.mediaFilename}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-70"
            style={{
              width: 34,
              height: 34,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.65)",
              cursor: "pointer",
            }}
            aria-label="Close class preview"
          >
            x
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5">
            <div
              className="w-full flex items-center justify-center rounded-[20px] overflow-hidden"
              style={{
                minHeight: 420,
                height: "68vh",
                background: "#000",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {preview.loading && (
                <div className="flex flex-col items-center gap-4">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      border: "2px solid rgba(79,179,255,0.15)",
                      borderTopColor: "#4fb3ff",
                      borderRadius: "50%",
                      animation: "spin 0.85s linear infinite",
                    }}
                  />
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Loading class preview...
                  </p>
                </div>
              )}

              {!preview.loading && preview.error && (
                <div className="max-w-md px-6 text-center">
                  <p className="text-sm" style={{ color: "rgba(255,170,170,0.92)" }}>
                    {preview.error}
                  </p>
                </div>
              )}

              {!preview.loading && !preview.error && preview.mediaUrl && preview.mediaType === "video" && (
                <div className="relative flex w-full h-full items-center justify-center">
                  <video
                    ref={videoRef}
                    src={preview.mediaUrl}
                    preload="auto"
                    muted
                    playsInline
                    className="hidden"
                  />
                  {!frameError && (
                    <canvas
                      ref={canvasRef}
                      className="block max-w-full"
                      style={{ width: "100%", height: "auto", maxHeight: "68vh" }}
                    />
                  )}
                  {frameLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          border: "2px solid rgba(79,179,255,0.15)",
                          borderTopColor: "#4fb3ff",
                          borderRadius: "50%",
                          animation: "spin 0.85s linear infinite",
                        }}
                      />
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.42)" }}>
                        Extracting the saved frame from the recording...
                      </p>
                    </div>
                  )}
                  {frameError && (
                    <div className="max-w-md px-6 text-center">
                      <p className="text-sm" style={{ color: "rgba(255,170,170,0.92)" }}>
                        {frameError}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {currentMoment && (
              <div className="flex flex-wrap gap-2 mt-3">
                {getMomentFrameIndex(currentMoment) != null && (
                  <span
                    className="px-3 py-1 rounded-full text-[11px]"
                    style={{
                      background: "rgba(79,179,255,0.12)",
                      border: "1px solid rgba(79,179,255,0.24)",
                      color: "#90caff",
                    }}
                  >
                    Frame {getMomentFrameIndex(currentMoment)}
                  </span>
                )}
                {currentMoment.sourceTimestampSec != null && (
                  <span
                    className="px-3 py-1 rounded-full text-[11px]"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.76)",
                    }}
                  >
                    {currentMoment.sourceTimestampSec.toFixed(2)}s
                  </span>
                )}
              </div>
            )}

            {preview.note && (
              <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.42)" }}>
                {preview.note}
              </p>
            )}
          </div>

          <div
            className="p-5"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            <h3 className="text-white text-sm font-medium mb-3">Detected moments</h3>
            <div className="grid grid-cols-1 gap-2 max-h-[70vh] overflow-y-auto pr-1">
              {preview.moments.length === 0 && (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.36)" }}>
                  No saved violations were found for this class.
                </p>
              )}

              {preview.moments.map((moment, index) => {
                const selected = index === preview.selectedMomentIndex;
                const strongestConfidence = Math.max(
                  ...moment.events.map((event) => event.confidence ?? 0),
                );

                return (
                  <button
                    key={moment.id}
                    type="button"
                    onClick={() => onSelectMoment(index)}
                    className="text-left rounded-2xl p-3"
                    style={{
                      background: selected
                        ? "rgba(79,179,255,0.14)"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${
                        selected ? "rgba(79,179,255,0.28)" : "rgba(255,255,255,0.08)"
                      }`,
                      color: "rgba(255,255,255,0.82)",
                      cursor: "pointer",
                    }}
                  >
                    <p className="text-xs">
                      {moment.sourceTimestampSec != null
                        ? `At ${moment.sourceTimestampSec.toFixed(2)}s`
                        : moment.detectedAt}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
                      {moment.events.length} bbox{moment.events.length === 1 ? "" : "es"} · strongest{" "}
                      {(strongestConfidence * 100).toFixed(1)}%
                    </p>
                    {getMomentFrameIndex(moment) != null && (
                      <p
                        className="text-[11px] mt-2"
                        style={{ color: "rgba(79,179,255,0.68)", fontFamily: "monospace" }}
                      >
                        frame {getMomentFrameIndex(moment)}
                      </p>
                    )}
                    {moment.events.map((event, eventIndex) => (
                      <p
                        key={`${moment.id}-${eventIndex}`}
                        className="text-[11px] mt-2"
                        style={{ color: "rgba(255,255,255,0.52)", fontFamily: "monospace" }}
                      >
                        {event.bbox
                          ? `bbox(${event.bbox.x1.toFixed(0)}, ${event.bbox.y1.toFixed(0)}, ${event.bbox.x2.toFixed(0)}, ${event.bbox.y2.toFixed(0)})`
                          : "bbox unavailable"}
                      </p>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordingCard({
  recording,
  busyAction,
  analysisSummary,
  selectedClassesCount,
  canDelete,
  onPreview,
  onDownload,
  onAnalyze,
  onDelete,
}: {
  recording: RecordingListItem;
  busyAction?: ActionKind;
  analysisSummary?: string;
  selectedClassesCount: number;
  canDelete: boolean;
  onPreview: (recording: RecordingListItem) => void;
  onDownload: (recording: RecordingListItem) => void;
  onAnalyze: (recording: RecordingListItem) => void;
  onDelete: (recording: RecordingListItem) => void;
}) {
  const isBusy = busyAction !== undefined;
  const canAnalyze = selectedClassesCount > 0 && !isBusy;

  return (
    <article
      className="rounded-[24px] p-4 flex flex-col gap-4"
      style={{
        background: "rgba(7,12,24,0.78)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 24px rgba(0,10,40,0.18)",
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="px-2.5 py-1 rounded-full text-[11px]"
              style={{
                background: "rgba(79,179,255,0.1)",
                border: "1px solid rgba(79,179,255,0.18)",
                color: "#90caff",
              }}
            >
              {ROOT_OPTIONS.find((option) => option.value === recording.recordingRoot)?.label}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-[11px]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.56)",
              }}
            >
              {roomTypeLabel(recording.roomType)}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-white tracking-tight">{recording.roomId}</h2>
          <p
            className="text-sm mt-1"
            style={{ color: "rgba(255,255,255,0.56)" }}
          >
            {formatDate(recording.createdAt)}
          </p>
          <p
            className="text-sm mt-2 truncate"
            style={{ color: "rgba(255,255,255,0.4)" }}
            title={recording.folderName}
          >
            {fileNameFromKey(recording.folderName)}
          </p>

          <div
            className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <span>{ROOT_OPTIONS.find((option) => option.value === recording.recordingRoot)?.label}</span>
            <span>{roomTypeLabel(recording.roomType)}</span>
            <span>
              {recording.roomCompositeEgressEnabled ? "Composite recording" : "Track recording"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => onPreview(recording)}
            disabled={isBusy}
            className="px-3 py-2 rounded-2xl text-xs transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.82)",
              cursor: isBusy ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {busyAction === "preview" ? "Loading..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => onDownload(recording)}
            disabled={isBusy}
            className="px-3 py-2 rounded-2xl text-xs transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.82)",
              cursor: isBusy ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {busyAction === "download" ? "Saving..." : "Download"}
          </button>
          <button
            type="button"
            onClick={() => onAnalyze(recording)}
            disabled={!canAnalyze}
            className="px-3 py-2 rounded-2xl text-xs transition-opacity hover:opacity-80"
            style={{
              background: canAnalyze ? "#edf4ff" : "rgba(255,255,255,0.06)",
              border: canAnalyze
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid rgba(255,255,255,0.1)",
              color: canAnalyze ? "#1638b7" : "rgba(255,255,255,0.45)",
              cursor: canAnalyze ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
            }}
          >
            {busyAction === "analyze"
              ? "Running..."
              : selectedClassesCount > 0
                ? `Run AI (${selectedClassesCount})`
                : "Run AI"}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(recording)}
              disabled={isBusy}
              className="px-3 py-2 rounded-2xl text-xs transition-opacity hover:opacity-80"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.22)",
                color: "#ffb4b4",
                cursor: isBusy ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
              }}
            >
              {busyAction === "delete" ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>

      {analysisSummary && (
        <div
          className="rounded-2xl px-3 py-2 text-xs"
          style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.18)",
            color: "rgba(170,245,195,0.92)",
          }}
        >
          {analysisSummary}
        </div>
      )}

      <details
        className="rounded-2xl px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <summary
          className="text-xs cursor-pointer"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          Advanced details
        </summary>
        <div className="grid grid-cols-1 gap-3 mt-3 text-xs">
          <div style={{ color: "rgba(255,255,255,0.78)" }}>
            <p style={{ color: "rgba(255,255,255,0.38)" }}>Folder</p>
            <p className="mt-1">{recording.folderName}</p>
          </div>
          <div
            style={{ color: "rgba(255,255,255,0.52)", fontFamily: "monospace" }}
            title={recording.pathPrefix || ""}
          >
            {truncateMiddle(recording.pathPrefix, 82)}
          </div>
          <div style={{ color: "rgba(255,255,255,0.78)" }}>
            <p style={{ color: "rgba(255,255,255,0.38)" }}>Storage bucket</p>
            <p className="mt-1">{recording.storageBucket || "No bucket recorded"}</p>
          </div>
          {(recording.trackRecordingTemplate || recording.compositeRecordingTemplate) && (
            <div className="grid grid-cols-1 gap-2">
              {recording.trackRecordingTemplate && (
                <p
                  style={{ color: "rgba(255,255,255,0.46)", fontFamily: "monospace" }}
                  title={recording.trackRecordingTemplate}
                >
                  Track: {truncateMiddle(recording.trackRecordingTemplate, 82)}
                </p>
              )}
              {recording.compositeRecordingTemplate && (
                <p
                  style={{ color: "rgba(255,255,255,0.46)", fontFamily: "monospace" }}
                  title={recording.compositeRecordingTemplate}
                >
                  Composite: {truncateMiddle(recording.compositeRecordingTemplate, 82)}
                </p>
              )}
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

function AnalysisJobCard({
  job,
  loading,
  onRefresh,
  onOpenClassPreview,
  onNotifyViolation,
  notificationLoadingByKey,
  notificationStateByKey,
  onOpenSignedDownload,
  onCopySignedDownload,
}: {
  job: RecordingAnalysisJob;
  loading: boolean;
  onRefresh: (jobId: string) => void;
  onOpenClassPreview: (job: RecordingAnalysisJob, label: string, subJobId: string | null) => void;
  onNotifyViolation: (job: RecordingAnalysisJob, label: string) => void;
  notificationLoadingByKey: Record<string, boolean>;
  notificationStateByKey: Record<string, ClassNotificationState>;
  onOpenSignedDownload: (url: string) => void;
  onCopySignedDownload: (url: string) => void;
}) {
  const tone = getStatusTone(job.status);
  const subJobs = getSubJobSummaries(job);
  const aggregateSummary = getAggregateResultSummary(job);
  const previewEnabled =
    job.status === "completed" ||
    job.status === "completed_with_errors" ||
    job.completedAt != null;

  return (
    <div
      className="rounded-[22px] p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-medium text-sm">{job.jobId}</p>
          <p
            className="text-xs mt-1 truncate"
            style={{ color: "rgba(255,255,255,0.42)" }}
            title={job.sourceName || `recording-${job.recordingDetailId}`}
          >
            {job.sourceName || `recording-${job.recordingDetailId}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-[11px]"
            style={{
              background: tone.background,
              border: `1px solid ${tone.border}`,
              color: tone.color,
            }}
          >
            {formatStatusLabel(job.status)}
          </span>
          <button
            type="button"
            onClick={() => onRefresh(job.jobId)}
            disabled={loading}
            className="px-2.5 py-1 rounded-full text-[11px]"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.74)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {job.requestedClasses.map((label) => (
          <span
            key={label}
            className="px-2.5 py-1 rounded-full text-[11px]"
            style={{
              background: "rgba(79,179,255,0.1)",
              border: "1px solid rgba(79,179,255,0.18)",
              color: "#90caff",
            }}
          >
            {formatClassLabel(label)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: "rgba(255,255,255,0.58)" }}>
        <span>Created {formatDate(job.createdAt)}</span>
        <span>{job.completedAt ? `Completed ${formatDate(job.completedAt)}` : "Still running"}</span>
      </div>

      {job.selectedObjectKey && (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
          File: {truncateMiddle(job.selectedObjectKey, 74)}
        </p>
      )}

      {subJobs.length > 0 && (
        <details
          className="rounded-2xl px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <summary
            className="text-xs cursor-pointer"
            style={{ color: "rgba(255,255,255,0.76)" }}
          >
            Class runs ({subJobs.length})
          </summary>
          <div className="grid grid-cols-1 gap-2 mt-3">
            {subJobs.map((subJob) => {
              const subTone = getStatusTone(subJob.state);
              const moments = getClassDetectionMoments(job, subJob.label);
              const canPreviewClass = previewEnabled && (moments.length > 0 || subJob.jobId != null);
              const canNotifyClass = previewEnabled && moments.length > 0;
              const notificationKey = getClassNotificationKey(job.jobId, subJob.label);
              const notificationState = notificationStateByKey[notificationKey] ?? null;
              const notificationLoading = notificationLoadingByKey[notificationKey] === true;
              return (
                <div
                  key={`${job.jobId}-${subJob.label}`}
                  className="rounded-2xl px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-white">{formatClassLabel(subJob.label)}</p>
                      {subJob.jobId && (
                        <p
                          className="text-[11px] mt-1 truncate"
                          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}
                          title={subJob.jobId}
                        >
                          {subJob.jobId}
                        </p>
                      )}
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px]"
                      style={{
                        background: subTone.background,
                        border: `1px solid ${subTone.border}`,
                        color: subTone.color,
                      }}
                    >
                      {formatStatusLabel(subJob.state)}
                    </span>
                  </div>
                  {subJob.lastError && (
                    <p className="text-[11px] mt-2" style={{ color: "rgba(255,170,170,0.92)" }}>
                      {subJob.lastError}
                    </p>
                  )}
                  {(canPreviewClass || canNotifyClass) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canPreviewClass && (
                        <button
                          type="button"
                          onClick={() => onOpenClassPreview(job, subJob.label, subJob.jobId)}
                          className="px-3 py-1.5 rounded-2xl text-[11px] transition-opacity hover:opacity-80"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.82)",
                            cursor: "pointer",
                          }}
                        >
                          Open preview
                        </button>
                      )}
                      {canNotifyClass && (
                        <button
                          type="button"
                          onClick={() => onNotifyViolation(job, subJob.label)}
                          disabled={notificationLoading}
                          className="px-3 py-1.5 rounded-2xl text-[11px] transition-opacity hover:opacity-80"
                          style={{
                            background: "rgba(79,179,255,0.1)",
                            border: "1px solid rgba(79,179,255,0.18)",
                            color: "#90caff",
                            cursor: notificationLoading ? "not-allowed" : "pointer",
                            opacity: notificationLoading ? 0.6 : 1,
                          }}
                        >
                          {notificationLoading ? "Sending..." : "Notify HSE"}
                        </button>
                      )}
                    </div>
                  )}
                  {notificationState && (
                    <div
                      className="mt-3 rounded-2xl px-3 py-2 text-[11px] flex flex-col gap-2"
                      style={{
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.16)",
                        color: "rgba(170,245,195,0.92)",
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Email {formatStatusLabel(notificationState.response.status)} to{" "}
                          {notificationState.response.recipient || "configured recipient"}
                        </span>
                        <span style={{ color: "rgba(170,245,195,0.74)" }}>
                          {formatDate(notificationState.sentAt)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Attachment {notificationState.response.attachmentIncluded ? "included" : "not included"}
                        </span>
                        {notificationState.response.subject && (
                          <span
                            className="truncate"
                            style={{ color: "rgba(170,245,195,0.78)" }}
                            title={notificationState.response.subject}
                          >
                            {notificationState.response.subject}
                          </span>
                        )}
                      </div>
                      {notificationState.response.downloadUrl && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenSignedDownload(notificationState.response.downloadUrl as string)}
                            className="px-2.5 py-1 rounded-full text-[10px] transition-opacity hover:opacity-80"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.82)",
                              cursor: "pointer",
                            }}
                          >
                            Open signed link
                          </button>
                          <button
                            type="button"
                            onClick={() => onCopySignedDownload(notificationState.response.downloadUrl as string)}
                            className="px-2.5 py-1 rounded-full text-[10px] transition-opacity hover:opacity-80"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.82)",
                              cursor: "pointer",
                            }}
                          >
                            Copy link
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {aggregateSummary && (
        <div
          className="rounded-2xl px-3 py-2 text-xs"
          style={{
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
            color: "rgba(170,245,195,0.92)",
          }}
        >
          {aggregateSummary}
        </div>
      )}

      {(job.aggregateResult || job.subJobs) && (
        <details
          className="rounded-2xl px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <summary
            className="text-xs cursor-pointer"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            Inspect saved job JSON
          </summary>
          <pre
            className="mt-3 text-[11px] overflow-x-auto whitespace-pre-wrap"
            style={{ color: "rgba(255,255,255,0.56)", fontFamily: "monospace" }}
          >
            {JSON.stringify(
              {
                job_id: job.jobId,
                status: job.status,
                requested_classes: job.requestedClasses,
                sub_jobs: job.subJobs,
                aggregate_result: job.aggregateResult,
              },
              null,
              2,
            )}
          </pre>
        </details>
      )}

      {job.lastError && (
        <div
          className="rounded-2xl px-3 py-2 text-xs"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.22)",
            color: "rgba(255,170,170,0.92)",
          }}
        >
          {job.lastError}
        </div>
      )}
    </div>
  );
}

function DetectorJobCard({ job }: { job: DetectorJobStatus }) {
  const tone = getStatusTone(job.state);

  return (
    <div
      className="rounded-[22px] p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-medium text-sm">{job.jobId}</p>
          <p
            className="text-xs mt-1 truncate"
            style={{ color: "rgba(255,255,255,0.42)" }}
            title={job.sourceName || "Live detector job"}
          >
            {job.sourceName || "Live detector job"}
          </p>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[11px]"
          style={{
            background: tone.background,
            border: `1px solid ${tone.border}`,
            color: tone.color,
          }}
        >
          {formatStatusLabel(job.state)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Frames {job.framesProcessed ?? 0}
        </span>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Events {job.eventsWritten ?? 0}
        </span>
      </div>

      {(job.startedAt || job.lastFrameAt) && (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          {job.startedAt ? `Started ${formatDate(job.startedAt)}` : "Started recently"}
          {job.lastFrameAt ? ` - Last frame ${formatDate(job.lastFrameAt)}` : ""}
        </p>
      )}

      {job.lastError && (
        <div
          className="rounded-2xl px-3 py-2 text-xs"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.22)",
            color: "rgba(255,170,170,0.92)",
          }}
        >
          {job.lastError}
        </div>
      )}
    </div>
  );
}

export default function RecordingPage() {
  const navigate = useNavigate();
  const { authSession, setCurrentPage } = useAppContext();
  const previewUrlRef = useRef<string | null>(null);
  const classPreviewUrlRef = useRef<string | null>(null);

  const [recordingRoot, setRecordingRoot] = useState<RecordingRoot>("livekit_recordings");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [folderNameInput, setFolderNameInput] = useState("");
  const [appliedRoomId, setAppliedRoomId] = useState("");
  const [appliedFolderName, setAppliedFolderName] = useState("");
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [busyActionById, setBusyActionById] = useState<Record<string, ActionKind>>({});
  const [analysisSummaryById, setAnalysisSummaryById] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [supportedClasses, setSupportedClasses] = useState<string[]>([
    ...DEFAULT_RECORDING_ANALYSIS_CLASSES,
  ]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([
    ...DEFAULT_RECORDING_ANALYSIS_CLASSES,
  ]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [modelClasses, setModelClasses] = useState<string[]>([]);
  const [includeCompletedJobs, setIncludeCompletedJobs] = useState(false);
  const [jobsStatus, setJobsStatus] = useState<JobsStatusResponse | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [jobRefreshLoadingById, setJobRefreshLoadingById] = useState<Record<string, boolean>>({});
  const [notificationLoadingByKey, setNotificationLoadingByKey] = useState<Record<string, boolean>>(
    {},
  );
  const [notificationStateByKey, setNotificationStateByKey] = useState<
    Record<string, ClassNotificationState>
  >({});
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    recording: null,
    deleteStorageFiles: true,
  });
  const [preview, setPreview] = useState<PreviewState>({
    recording: null,
    url: null,
    filename: null,
    loading: false,
    error: null,
  });
  const [classPreview, setClassPreview] = useState<ClassPreviewState>({
    job: null,
    recording: null,
    label: null,
    subJobId: null,
    moments: [],
    selectedMomentIndex: 0,
    mediaType: null,
    mediaUrl: null,
    mediaFilename: null,
    loading: false,
    error: null,
    note: null,
  });

  useEffect(() => {
    setCurrentPage("recordings");
  }, [setCurrentPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadSupportedClasses() {
      setClassesLoading(true);
      setClassesError(null);

      try {
        const response = await fetchSupportedAiClasses();
        if (cancelled) return;

        const labels = response.supportedDetectionLabels.length
          ? response.supportedDetectionLabels
          : [...DEFAULT_RECORDING_ANALYSIS_CLASSES];

        setSupportedClasses(labels);
        setModelPath(response.modelPath);
        setModelClasses(response.modelClasses);
        setSelectedClasses((current) => {
          const validCurrent = current.filter((label) => labels.includes(label));
          if (validCurrent.length > 0) return validCurrent;

          const validDefaults = DEFAULT_RECORDING_ANALYSIS_CLASSES.filter((label) =>
            labels.includes(label),
          );
          return validDefaults.length > 0 ? [...validDefaults] : [...labels];
        });
      } catch (loadError) {
        if (cancelled) return;

        setClassesError(
          loadError instanceof Error ? loadError.message : "Failed to load AI classes.",
        );
      } finally {
        if (!cancelled) {
          setClassesLoading(false);
        }
      }
    }

    void loadSupportedClasses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs(isInitialLoad: boolean) {
      if (isInitialLoad) {
        setJobsLoading(true);
      }
      setJobsError(null);

      try {
        const response = await fetchJobsStatus(includeCompletedJobs);
        if (cancelled) return;

        setJobsStatus(response);
      } catch (loadError) {
        if (cancelled) return;

        setJobsError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
      } finally {
        if (!cancelled) {
          setJobsLoading(false);
        }
      }
    }

    void loadJobs(true);
    const intervalId = window.setInterval(() => {
      void loadJobs(false);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [includeCompletedJobs, jobsRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await listRecordings({
          recordingRoot,
          roomId: appliedRoomId || undefined,
          folderName: appliedFolderName || undefined,
        });

        if (cancelled) return;

        setRecordings(response.items);
        setTotal(response.total);
      } catch (loadError) {
        if (cancelled) return;

        setRecordings([]);
        setTotal(0);
        setError(loadError instanceof Error ? loadError.message : "Failed to load recordings.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedFolderName, appliedRoomId, recordingRoot, refreshKey]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        window.URL.revokeObjectURL(previewUrlRef.current);
      }
      if (classPreviewUrlRef.current) {
        window.URL.revokeObjectURL(classPreviewUrlRef.current);
      }
    };
  }, []);

  function updateBusyAction(recordingId: number, action?: ActionKind) {
    const key = String(recordingId);
    setBusyActionById((previous) => {
      const next = { ...previous };
      if (action) {
        next[key] = action;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function closeDeleteDialog() {
    setDeleteDialog({
      recording: null,
      deleteStorageFiles: true,
    });
  }

  function resetPreview() {
    if (previewUrlRef.current) {
      window.URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreview({
      recording: null,
      url: null,
      filename: null,
      loading: false,
      error: null,
    });
  }

  function resetClassPreview() {
    if (classPreviewUrlRef.current) {
      window.URL.revokeObjectURL(classPreviewUrlRef.current);
      classPreviewUrlRef.current = null;
    }

    setClassPreview({
      job: null,
      recording: null,
      label: null,
      subJobId: null,
      moments: [],
      selectedMomentIndex: 0,
      mediaType: null,
      mediaUrl: null,
      mediaFilename: null,
      loading: false,
      error: null,
      note: null,
    });
  }

  function selectClassPreviewMoment(index: number) {
    setClassPreview((current) => ({
      ...current,
      selectedMomentIndex: index,
    }));
  }

  async function resolveRecordingForJob(job: RecordingAnalysisJob): Promise<RecordingListItem | null> {
    const existingMatch =
      recordings.find((recording) => recording.id === job.recordingDetailId) ?? null;
    if (existingMatch) return existingMatch;

    const folderName = extractFolderNameFromSourceName(job.sourceName);
    if (!folderName) return null;

    for (const root of ROOT_OPTIONS.map((option) => option.value)) {
      try {
        const response = await listRecordings({
          recordingRoot: root,
          folderName,
          limit: 20,
        });
        const resolved =
          response.items.find((recording) => recording.id === job.recordingDetailId) ??
          response.items[0] ??
          null;
        if (resolved) return resolved;
      } catch {
        // Ignore lookup failures here and keep trying the next root.
      }
    }

    return null;
  }

  async function openClassPreview(
    job: RecordingAnalysisJob,
    label: string,
    subJobId: string | null,
  ) {
    const moments = getClassDetectionMoments(job, label);

    resetClassPreview();
    setClassPreview({
      job,
      recording: null,
      label,
      subJobId,
      moments,
      selectedMomentIndex: 0,
      mediaType: null,
      mediaUrl: null,
      mediaFilename: null,
      loading: true,
      error: null,
      note: null,
    });

    try {
      const matchedRecording = await resolveRecordingForJob(job);

      if (matchedRecording) {
        const selectedFilename = job.selectedObjectKey
          ? fileNameFromKey(job.selectedObjectKey)
          : undefined;
        const file = await downloadRecordingFile(matchedRecording.id, {
          folderName: matchedRecording.folderName,
          filename: selectedFilename,
        });
        const objectUrl = window.URL.createObjectURL(file.blob);
        classPreviewUrlRef.current = objectUrl;

        setClassPreview((current) => ({
          ...current,
          recording: matchedRecording,
          loading: false,
          mediaType: "video",
          mediaUrl: objectUrl,
          mediaFilename: file.filename,
          note:
            moments.length > 0
              ? "Showing the saved frame directly from the original recording with bounding boxes drawn from the stored JSON."
              : "Showing the original recording. No saved violations were found for this class in the aggregate result.",
        }));
        return;
      }

      setClassPreview((current) => ({
        ...current,
        loading: false,
        error:
          "The original recording could not be resolved for this job, so the saved frame cannot be reconstructed from video.",
      }));
    } catch (previewError) {
      setClassPreview((current) => ({
        ...current,
        loading: false,
        error:
          previewError instanceof Error
            ? previewError.message
            : "Failed to load the class preview.",
      }));
    }
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedRoomId(roomIdInput.trim());
    setAppliedFolderName(folderNameInput.trim());
  }

  function handleClearFilters() {
    setRoomIdInput("");
    setFolderNameInput("");
    setAppliedRoomId("");
    setAppliedFolderName("");
  }

  function toggleSelectedClass(label: string) {
    setSelectedClasses((current) => {
      if (current.includes(label)) {
        return current.filter((item) => item !== label);
      }
      return [...current, label];
    });
  }

  function handleRequestDelete(recording: RecordingListItem) {
    setDeleteDialog({
      recording,
      deleteStorageFiles: true,
    });
  }

  async function refreshAnalysisJob(jobId: string) {
    setJobRefreshLoadingById((current) => ({ ...current, [jobId]: true }));

    try {
      const refreshedJob = await fetchRecordingAnalysisJob(jobId);
      setJobsStatus((current) => {
        if (!current) return current;

        const existingIndex = current.recordingAnalysisJobs.findIndex((job) => job.jobId === jobId);
        if (existingIndex === -1) {
          return {
            ...current,
            recordingAnalysisJobs: [refreshedJob, ...current.recordingAnalysisJobs],
            counts: {
              ...current.counts,
              recordingAnalysisJobs: current.counts.recordingAnalysisJobs + 1,
            },
          };
        }

        const nextJobs = [...current.recordingAnalysisJobs];
        nextJobs[existingIndex] = refreshedJob;
        return {
          ...current,
          recordingAnalysisJobs: nextJobs,
        };
      });
    } catch (refreshError) {
      setBanner({
        kind: "error",
        text: refreshError instanceof Error ? refreshError.message : "Failed to refresh job.",
      });
    } finally {
      setJobRefreshLoadingById((current) => {
        const next = { ...current };
        delete next[jobId];
        return next;
      });
    }
  }

  async function handleNotifyViolation(job: RecordingAnalysisJob, label: string) {
    const notificationKey = getClassNotificationKey(job.jobId, label);
    const moments = getClassDetectionMoments(job, label);

    if (moments.length === 0) {
      setBanner({
        kind: "error",
        text: `No saved ${formatClassLabel(label)} violations were found to email.`,
      });
      return;
    }

    setNotificationLoadingByKey((current) => ({ ...current, [notificationKey]: true }));

    try {
      const matchedRecording = await resolveRecordingForJob(job).catch(() => null);
      const fallbackFolderName =
        matchedRecording?.folderName ?? extractFolderNameFromSourceName(job.sourceName) ?? undefined;
      const selectedFilename = job.selectedObjectKey
        ? fileNameFromKey(job.selectedObjectKey)
        : undefined;
      const inferredRoomId =
        matchedRecording?.roomId ??
        extractRoomIdFromText(selectedFilename) ??
        extractRoomIdFromText(job.sourceName) ??
        undefined;
      const firstMoment = moments[0] ?? null;

      const response = await sendHseViolationEmail({
        violationLabel: label,
        roomId: inferredRoomId,
        folderName: fallbackFolderName,
        filename: selectedFilename,
        recordingDetailId: job.recordingDetailId,
        analysisJobId: job.jobId,
        detectedAt: firstMoment?.detectedAt ?? undefined,
      });

      setNotificationStateByKey((current) => ({
        ...current,
        [notificationKey]: {
          response,
          sentAt: new Date().toISOString(),
        },
      }));

      setBanner({
        kind: "success",
        text: response.recipient
          ? `HSE email queued for ${formatClassLabel(label)} to ${response.recipient}.`
          : `HSE email queued for ${formatClassLabel(label)}.`,
      });
    } catch (notificationError) {
      setBanner({
        kind: "error",
        text:
          notificationError instanceof Error
            ? notificationError.message
            : "Failed to queue the HSE violation email.",
      });
    } finally {
      setNotificationLoadingByKey((current) => {
        const next = { ...current };
        delete next[notificationKey];
        return next;
      });
    }
  }

  function handleOpenSignedDownload(url: string) {
    triggerSignedDownload(url);
  }

  async function handleCopySignedDownload(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setBanner({
        kind: "success",
        text: "Signed recording download link copied.",
      });
    } catch {
      setBanner({
        kind: "error",
        text: "Could not copy the signed recording download link.",
      });
    }
  }

  async function handleDownload(recording: RecordingListItem) {
    updateBusyAction(recording.id, "download");

    try {
      const file = await downloadRecordingFile(recording.id, {
        folderName: recording.folderName,
      });

      downloadBlob(file.blob, file.filename);
      setBanner({
        kind: "success",
        text: `Downloaded ${file.filename}.`,
      });
    } catch (downloadError) {
      setBanner({
        kind: "error",
        text:
          downloadError instanceof Error
            ? downloadError.message
            : "Failed to download recording.",
      });
    } finally {
      updateBusyAction(recording.id);
    }
  }

  async function handlePreview(recording: RecordingListItem) {
    resetPreview();
    setPreview({
      recording,
      url: null,
      filename: null,
      loading: true,
      error: null,
    });
    updateBusyAction(recording.id, "preview");

    try {
      const file = await downloadRecordingFile(recording.id, {
        folderName: recording.folderName,
      });
      const objectUrl = window.URL.createObjectURL(file.blob);
      previewUrlRef.current = objectUrl;

      setPreview({
        recording,
        url: objectUrl,
        filename: file.filename,
        loading: false,
        error: null,
      });
    } catch (previewError) {
      const message =
        previewError instanceof Error ? previewError.message : "Failed to load recording preview.";
      setPreview({
        recording,
        url: null,
        filename: null,
        loading: false,
        error: message,
      });
      setBanner({
        kind: "error",
        text: message,
      });
    } finally {
      updateBusyAction(recording.id);
    }
  }

  async function handleAnalyze(recording: RecordingListItem) {
    if (selectedClasses.length === 0) {
      setBanner({
        kind: "error",
        text: "Select at least one detection class before starting AI analysis.",
      });
      return;
    }

    updateBusyAction(recording.id, "analyze");

    try {
      const response = await analyzeRecording(recording.id, {
        folderName: recording.folderName,
        classes: selectedClasses,
        sourceName: `recording-${recording.folderName}`,
      });

      const jobId = getRecordingAnalysisJobId(response);
      const selectedFile = response.analysisJob.selectedObjectKey
        ? fileNameFromKey(response.analysisJob.selectedObjectKey)
        : recording.folderName;
      const summary = jobId
        ? `AI job ${jobId} queued for ${selectedFile} across ${selectedClasses.length} class${selectedClasses.length === 1 ? "" : "es"}.`
        : response.message;

      setAnalysisSummaryById((previous) => ({
        ...previous,
        [String(recording.id)]: summary,
      }));
      setJobsStatus((current) => {
        const analysisJob = response.analysisJob;
        if (!current) {
          return {
            includeCompleted: includeCompletedJobs,
            detectorJobs: [],
            recordingAnalysisJobs: [analysisJob],
            counts: {
              detectorJobs: 0,
              recordingAnalysisJobs: 1,
            },
          };
        }

        return {
          ...current,
          recordingAnalysisJobs: [
            analysisJob,
            ...current.recordingAnalysisJobs.filter((job) => job.jobId !== analysisJob.jobId),
          ],
          counts: {
            ...current.counts,
            recordingAnalysisJobs: current.recordingAnalysisJobs.some(
              (job) => job.jobId === analysisJob.jobId,
            )
              ? current.counts.recordingAnalysisJobs
              : current.counts.recordingAnalysisJobs + 1,
          },
        };
      });
      setBanner({
        kind: "success",
        text: summary,
      });
      setJobsRefreshKey((value) => value + 1);
    } catch (analyzeError) {
      setBanner({
        kind: "error",
        text:
          analyzeError instanceof Error
            ? analyzeError.message
            : "Failed to start AI analysis.",
      });
    } finally {
      updateBusyAction(recording.id);
    }
  }

  async function handleConfirmDelete() {
    const recording = deleteDialog.recording;
    if (!recording) return;

    const deletedJobIds = new Set(
      recordingAnalysisJobs
        .filter((job) => job.recordingDetailId === recording.id)
        .map((job) => job.jobId),
    );

    updateBusyAction(recording.id, "delete");

    try {
      await deleteRecording(recording.id, {
        deleteStorageFiles: deleteDialog.deleteStorageFiles,
      });

      if (preview.recording?.id === recording.id) {
        resetPreview();
      }
      if (
        classPreview.recording?.id === recording.id ||
        classPreview.job?.recordingDetailId === recording.id
      ) {
        resetClassPreview();
      }

      setRecordings((current) => current.filter((item) => item.id !== recording.id));
      setTotal((current) => Math.max(0, current - 1));
      setAnalysisSummaryById((current) => {
        const next = { ...current };
        delete next[String(recording.id)];
        return next;
      });
      setJobsStatus((current) => {
        if (!current) return current;

        const nextJobs = current.recordingAnalysisJobs.filter(
          (job) => job.recordingDetailId !== recording.id,
        );
        const removedCount = current.recordingAnalysisJobs.length - nextJobs.length;
        return {
          ...current,
          recordingAnalysisJobs: nextJobs,
          counts: {
            ...current.counts,
            recordingAnalysisJobs: Math.max(
              0,
              current.counts.recordingAnalysisJobs - removedCount,
            ),
          },
        };
      });
      setJobRefreshLoadingById((current) => {
        if (deletedJobIds.size === 0) return current;

        const next = { ...current };
        deletedJobIds.forEach((jobId) => {
          delete next[jobId];
        });
        return next;
      });
      setNotificationLoadingByKey((current) => {
        if (deletedJobIds.size === 0) return current;

        const next = { ...current };
        Object.keys(next).forEach((key) => {
          const [jobId] = key.split(":");
          if (jobId && deletedJobIds.has(jobId)) {
            delete next[key];
          }
        });
        return next;
      });
      setNotificationStateByKey((current) => {
        if (deletedJobIds.size === 0) return current;

        const next = { ...current };
        Object.keys(next).forEach((key) => {
          const [jobId] = key.split(":");
          if (jobId && deletedJobIds.has(jobId)) {
            delete next[key];
          }
        });
        return next;
      });
      closeDeleteDialog();
      setBanner({
        kind: "success",
        text: deleteDialog.deleteStorageFiles
          ? `Deleted ${recording.folderName} and its stored files.`
          : `Deleted ${recording.folderName}.`,
      });
      setJobsRefreshKey((value) => value + 1);
    } catch (deleteError) {
      setBanner({
        kind: "error",
        text:
          deleteError instanceof Error ? deleteError.message : "Failed to delete recording.",
      });
    } finally {
      updateBusyAction(recording.id);
    }
  }

  const recordingAnalysisJobs = jobsStatus?.recordingAnalysisJobs ?? [];
  const detectorJobs = jobsStatus?.detectorJobs ?? [];
  const totalJobCount = recordingAnalysisJobs.length + detectorJobs.length;
  const currentUserId = authSession?.user.id ?? null;
  const deleteDialogBusy =
    deleteDialog.recording != null &&
    busyActionById[String(deleteDialog.recording.id)] === "delete";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

        .rec-root * { box-sizing: border-box; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="rec-root flex flex-col min-h-screen"
        style={{
          background: "linear-gradient(160deg, #07111f 0%, #060d1c 50%, #040a18 100%)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <header
          className="flex items-center justify-between px-5 py-3 sticky top-0 z-40"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(5,10,25,0.82)",
            backdropFilter: "blur(16px)",
          }}
        >
          <img src="/SixDX White.svg" alt="SixDX" style={{ height: 28 }} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="px-3 py-2 rounded-xl text-xs transition-all duration-150 hover:-translate-y-0.5 hover:opacity-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.72)",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-3 py-2 rounded-xl text-xs transition-all duration-150 hover:-translate-y-0.5 hover:opacity-95 flex items-center gap-1.5"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.72)",
                cursor: "pointer",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-5 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-white">Recordings</h1>
                <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.38)" }}>
                  Browse recordings, preview them, and run AI review from one calmer workspace.
                </p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {recordings.length} shown in {ROOT_OPTIONS.find((option) => option.value === recordingRoot)?.label}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {ROOT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRecordingRoot(option.value)}
                    className="text-left rounded-full px-4 py-2.5 transition-all duration-150"
                    style={{
                      background:
                        recordingRoot === option.value
                          ? "rgba(79,179,255,0.14)"
                          : "rgba(255,255,255,0.04)",
                      border: `1px solid ${
                        recordingRoot === option.value
                          ? "rgba(79,179,255,0.28)"
                          : "rgba(255,255,255,0.08)"
                      }`,
                      color:
                        recordingRoot === option.value
                          ? "#90caff"
                          : "rgba(255,255,255,0.78)",
                      cursor: "pointer",
                    }}
                  >
                    <p className="font-medium text-sm">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleApplyFilters}
              className="rounded-[24px] p-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3">
                <div>
                  <label
                    className="block text-xs mb-2"
                    style={{ color: "rgba(255,255,255,0.38)" }}
                  >
                    Room code
                  </label>
                  <input
                    type="text"
                    value={roomIdInput}
                    placeholder="ABC-123-XYZ"
                    onChange={(event) => setRoomIdInput(formatRoomCode(event.target.value))}
                    maxLength={11}
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.86)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs mb-2"
                    style={{ color: "rgba(255,255,255,0.38)" }}
                  >
                    File or folder
                  </label>
                  <input
                    type="text"
                    value={folderNameInput}
                    placeholder="meeting-janedoe-20260511T120000Z"
                    onChange={(event) => setFolderNameInput(event.target.value)}
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.86)",
                    }}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="px-4 py-3 rounded-2xl text-sm"
                    style={{
                      background: "#edf4ff",
                      color: "#1638b7",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-3 rounded-2xl text-sm"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.7)",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </form>

            {recordingRoot === "hse_safety_audit" && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.02fr_0.98fr] gap-4 items-start">
                <section
                  className="rounded-[24px] p-5"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-white font-medium">AI Detection</h2>
                      <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                        Pick the classes to run when you start analysis on a recording.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = DEFAULT_RECORDING_ANALYSIS_CLASSES.filter((label) =>
                          supportedClasses.includes(label),
                        );
                        setSelectedClasses(defaults.length > 0 ? [...defaults] : [...supportedClasses]);
                      }}
                      disabled={classesLoading || supportedClasses.length === 0}
                      className="px-3 py-2 rounded-full text-xs"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.76)",
                        cursor:
                          classesLoading || supportedClasses.length === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      Use defaults
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {classesLoading && (
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
                        Loading classes...
                      </p>
                    )}

                    {!classesLoading &&
                      supportedClasses.map((label) => {
                        const selected = selectedClasses.includes(label);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleSelectedClass(label)}
                            className="px-3 py-2 rounded-full text-xs"
                            style={{
                              background: selected
                                ? "rgba(79,179,255,0.14)"
                                : "rgba(255,255,255,0.05)",
                              border: `1px solid ${
                                selected ? "rgba(79,179,255,0.24)" : "rgba(255,255,255,0.1)"
                              }`,
                              color: selected ? "#90caff" : "rgba(255,255,255,0.7)",
                              cursor: "pointer",
                            }}
                          >
                            {formatClassLabel(label)}
                          </button>
                        );
                      })}
                  </div>

                  {classesError && (
                    <p className="text-sm mb-4" style={{ color: "rgba(255,170,170,0.92)" }}>
                      {classesError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs" style={{ color: "rgba(255,255,255,0.56)" }}>
                    <span>
                      {selectedClasses.length} class{selectedClasses.length === 1 ? "" : "es"} selected
                    </span>
                    <span>{modelClasses.length} classes in model</span>
                  </div>

                  <details
                    className="rounded-2xl px-3 py-2 mt-4"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <summary
                      className="text-xs cursor-pointer"
                      style={{ color: "rgba(255,255,255,0.76)" }}
                    >
                      Model info
                    </summary>
                    <div className="grid grid-cols-1 gap-2 mt-3 text-xs">
                      <p style={{ color: "rgba(255,255,255,0.76)", fontFamily: "monospace" }}>
                        {modelPath || "Unknown model path"}
                      </p>
                    </div>
                  </details>
                </section>

                <section
                  className="rounded-[24px] p-5"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <details>
                    <summary
                      className="flex items-center justify-between gap-3 cursor-pointer"
                      style={{ listStyle: "none" }}
                    >
                      <div>
                        <h2 className="text-white font-medium">Jobs</h2>
                        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                          Track running and completed detector work without leaving the page.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.78)",
                          }}
                        >
                          {recordingAnalysisJobs.length} analysis
                        </span>
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.78)",
                          }}
                        >
                          {detectorJobs.length} detector
                        </span>
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.78)",
                          }}
                        >
                          {totalJobCount} total
                        </span>
                      </div>
                    </summary>

                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <label
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                        >
                          <input
                            type="checkbox"
                            checked={includeCompletedJobs}
                            onChange={(event) => setIncludeCompletedJobs(event.target.checked)}
                          />
                          Include completed jobs
                        </label>

                        <button
                          type="button"
                          onClick={() => setJobsRefreshKey((value) => value + 1)}
                          className="px-3 py-2 rounded-full text-xs"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.76)",
                            cursor: "pointer",
                          }}
                        >
                          Refresh jobs
                        </button>
                      </div>

                      {jobsLoading && !jobsStatus && (
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
                          Loading jobs...
                        </p>
                      )}

                      {jobsError && (
                        <p className="text-sm mb-4" style={{ color: "rgba(255,170,170,0.92)" }}>
                          {jobsError}
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm text-white">Recording analysis jobs</h3>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.36)" }}>
                              Parent jobs saved by job id
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {recordingAnalysisJobs.length === 0 && (
                              <p className="text-sm" style={{ color: "rgba(255,255,255,0.34)" }}>
                                No matching analysis jobs right now.
                              </p>
                            )}
                            {recordingAnalysisJobs.map((job) => (
                              <AnalysisJobCard
                                key={job.jobId}
                                job={job}
                                loading={jobRefreshLoadingById[job.jobId] === true}
                                onRefresh={refreshAnalysisJob}
                                onOpenClassPreview={openClassPreview}
                                onNotifyViolation={handleNotifyViolation}
                                notificationLoadingByKey={notificationLoadingByKey}
                                notificationStateByKey={notificationStateByKey}
                                onOpenSignedDownload={handleOpenSignedDownload}
                                onCopySignedDownload={handleCopySignedDownload}
                              />
                            ))}
                          </div>
                        </div>

                        <details
                          className="rounded-2xl px-3 py-2"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <summary
                            className="flex items-center justify-between gap-3 cursor-pointer text-sm"
                            style={{ color: "rgba(255,255,255,0.78)" }}
                          >
                            <span>Detector jobs</span>
                            <span style={{ color: "rgba(255,255,255,0.42)" }}>
                              {detectorJobs.length} live worker{detectorJobs.length === 1 ? "" : "s"}
                            </span>
                          </summary>

                          <div className="grid grid-cols-1 gap-3 mt-3">
                            {detectorJobs.length === 0 && (
                              <p className="text-sm" style={{ color: "rgba(255,255,255,0.34)" }}>
                                No matching detector jobs right now.
                              </p>
                            )}
                            {detectorJobs.map((job) => (
                              <DetectorJobCard key={job.jobId} job={job} />
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  </details>
                </section>
              </div>
            )}

            {banner && (
              <div
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  background:
                    banner.kind === "success"
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.1)",
                  border: `1px solid ${
                    banner.kind === "success"
                      ? "rgba(34,197,94,0.22)"
                      : "rgba(239,68,68,0.25)"
                  }`,
                  color:
                    banner.kind === "success"
                      ? "rgba(170,245,195,0.92)"
                      : "rgba(255,160,160,0.92)",
                }}
              >
                <span className="text-sm">{banner.text}</span>
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    opacity: 0.65,
                  }}
                >
                  x
                </button>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div
                  style={{
                    width: 38,
                    height: 38,
                    border: "2px solid rgba(79,179,255,0.15)",
                    borderTopColor: "#4fb3ff",
                    borderRadius: "50%",
                    animation: "spin 0.85s linear infinite",
                  }}
                />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.34)" }}>
                  Loading recordings...
                </p>
              </div>
            )}

            {!loading && error && (
              <div
                className="rounded-[28px] p-6"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <p className="text-sm" style={{ color: "rgba(255,160,160,0.92)" }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="mt-4 px-4 py-2 rounded-2xl text-sm"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.8)",
                    cursor: "pointer",
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && recordings.length === 0 && (
              <div
                className="rounded-[28px] p-8 text-center"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.36)" }}>
                  No recordings matched the current filters.
                </p>
              </div>
            )}

            {!loading && !error && recordings.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {recordings.map((recording) => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    busyAction={busyActionById[String(recording.id)]}
                    analysisSummary={analysisSummaryById[String(recording.id)]}
                    selectedClassesCount={selectedClasses.length}
                    canDelete={
                      currentUserId != null && recording.createdByUserId === currentUserId
                    }
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    onAnalyze={handleAnalyze}
                    onDelete={handleRequestDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {preview.recording && (
        <PreviewModal
          preview={preview}
          onClose={resetPreview}
          onDownload={handleDownload}
          downloadBusy={busyActionById[String(preview.recording.id)] === "download"}
        />
      )}

      {deleteDialog.recording && (
        <DeleteRecordingModal
          state={deleteDialog}
          busy={deleteDialogBusy}
          onClose={closeDeleteDialog}
          onToggleDeleteStorageFiles={(nextValue) =>
            setDeleteDialog((current) => ({
              ...current,
              deleteStorageFiles: nextValue,
            }))
          }
          onConfirm={handleConfirmDelete}
        />
      )}

      {classPreview.job && classPreview.label && (
        <ClassPreviewModal
          preview={classPreview}
          onClose={resetClassPreview}
          onSelectMoment={selectClassPreviewMoment}
        />
      )}
    </>
  );
}
