import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { formatRoomCode } from "../lib/meeting/roomCode";
import {
  analyzeRecording,
  DEFAULT_RECORDING_ANALYSIS_CLASSES,
  downloadRecordingFile,
  fetchAiJobPreview,
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

type ActionKind = "preview" | "download" | "analyze";

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
  mediaType: "video" | "image" | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  loading: boolean;
  error: string | null;
  note: string | null;
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
    if (preview.mediaType !== "video" || !currentMoment || !videoRef.current) return;

    const targetTime = Math.max(0, (currentMoment.sourceTimestampSec ?? 0) - 0.05);
    const video = videoRef.current;

    function seekToMoment() {
      video.currentTime = targetTime;
      void video.pause();
    }

    if (video.readyState >= 1) {
      seekToMoment();
      return;
    }

    video.addEventListener("loadedmetadata", seekToMoment, { once: true });
    return () => {
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
                height: preview.mediaType === "image" ? "68vh" : undefined,
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
                <div className="relative inline-block max-w-full">
                  <video
                    ref={videoRef}
                    src={preview.mediaUrl}
                    controls
                    className="block max-w-full max-h-[68vh]"
                  />
                  {currentMoment && currentMoment.frameWidth > 0 && currentMoment.frameHeight > 0 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox={`0 0 ${currentMoment.frameWidth} ${currentMoment.frameHeight}`}
                      preserveAspectRatio="none"
                    >
                      {currentMoment.events.map((event, index) => (
                        event.bbox ? (
                          <g key={`${currentMoment.id}-${index}`}>
                            <rect
                              x={event.bbox.x1}
                              y={event.bbox.y1}
                              width={Math.max(0, event.bbox.x2 - event.bbox.x1)}
                              height={Math.max(0, event.bbox.y2 - event.bbox.y1)}
                              fill="rgba(239,68,68,0.1)"
                              stroke="#ef4444"
                              strokeWidth="4"
                            />
                            <text
                              x={event.bbox.x1}
                              y={Math.max(20, event.bbox.y1 - 8)}
                              fill="#ffffff"
                              fontSize="20"
                              fontWeight="600"
                              stroke="rgba(0,0,0,0.35)"
                              strokeWidth="1"
                              paintOrder="stroke"
                            >
                              {formatClassLabel(event.label)}
                              {event.confidence != null
                                ? ` ${(event.confidence * 100).toFixed(1)}%`
                                : ""}
                            </text>
                          </g>
                        ) : null
                      ))}
                    </svg>
                  )}
                </div>
              )}

              {!preview.loading && !preview.error && preview.mediaUrl && preview.mediaType === "image" && (
                <div className="relative w-full h-full">
                  <img
                    src={preview.mediaUrl}
                    alt={`${preview.label} preview`}
                    className="block w-full h-full object-fill"
                  />
                  {currentMoment && currentMoment.frameWidth > 0 && currentMoment.frameHeight > 0 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox={`0 0 ${currentMoment.frameWidth} ${currentMoment.frameHeight}`}
                      preserveAspectRatio="none"
                    >
                      {currentMoment.events.map((event, index) => (
                        event.bbox ? (
                          <g key={`${currentMoment.id}-image-${index}`}>
                            <rect
                              x={event.bbox.x1}
                              y={event.bbox.y1}
                              width={Math.max(0, event.bbox.x2 - event.bbox.x1)}
                              height={Math.max(0, event.bbox.y2 - event.bbox.y1)}
                              fill="rgba(239,68,68,0.1)"
                              stroke="#ef4444"
                              strokeWidth="4"
                            />
                            <text
                              x={event.bbox.x1}
                              y={Math.max(20, event.bbox.y1 - 8)}
                              fill="#ffffff"
                              fontSize="20"
                              fontWeight="600"
                              stroke="rgba(0,0,0,0.35)"
                              strokeWidth="1"
                              paintOrder="stroke"
                            >
                              {formatClassLabel(event.label)}
                              {event.confidence != null
                                ? ` ${(event.confidence * 100).toFixed(1)}%`
                                : ""}
                            </text>
                          </g>
                        ) : null
                      ))}
                    </svg>
                  )}
                </div>
              )}
            </div>

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
  onPreview,
  onDownload,
  onAnalyze,
}: {
  recording: RecordingListItem;
  busyAction?: ActionKind;
  analysisSummary?: string;
  selectedClassesCount: number;
  onPreview: (recording: RecordingListItem) => void;
  onDownload: (recording: RecordingListItem) => void;
  onAnalyze: (recording: RecordingListItem) => void;
}) {
  const isBusy = busyAction !== undefined;
  const canAnalyze = selectedClassesCount > 0 && !isBusy;

  return (
    <div
      className="rounded-3xl p-5 flex flex-col gap-4"
      style={{
        background: "linear-gradient(160deg, rgba(10,18,40,0.92), rgba(6,12,28,0.96))",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 12px 32px rgba(0,10,60,0.3)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className="px-2.5 py-1 rounded-full text-[11px]"
              style={{
                background: "rgba(79,179,255,0.14)",
                border: "1px solid rgba(79,179,255,0.22)",
                color: "#90caff",
              }}
            >
              {ROOT_OPTIONS.find((option) => option.value === recording.recordingRoot)?.label}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-[11px]"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.48)",
              }}
            >
              {roomTypeLabel(recording.roomType)}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-white">{recording.roomId}</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {recording.folderName}
          </p>
        </div>

        <div
          className="rounded-2xl px-3 py-2 text-right"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>
            CREATED
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>
            {formatDate(recording.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm">
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            STORAGE
          </p>
          <p style={{ color: "rgba(255,255,255,0.82)" }}>
            {recording.storageBucket || "No bucket recorded"}
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "rgba(255,255,255,0.36)", fontFamily: "monospace" }}
          >
            {truncateMiddle(recording.pathPrefix)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl p-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              CREATOR
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.82)" }}>
              User #{recording.createdByUserId}
            </p>
          </div>
          <div
            className="rounded-2xl p-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-[11px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              EGRESS
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.82)" }}>
              {recording.autoTrackEgressEnabled ? "Tracks on" : "Tracks off"}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
              {recording.roomCompositeEgressEnabled ? "Composite on" : "Composite off"}
            </p>
          </div>
        </div>

        {(recording.trackRecordingTemplate || recording.compositeRecordingTemplate) && (
          <div
            className="rounded-2xl p-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-[11px] mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              TEMPLATES
            </p>
            {recording.trackRecordingTemplate && (
              <p
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.42)", fontFamily: "monospace" }}
              >
                Track: {truncateMiddle(recording.trackRecordingTemplate, 68)}
              </p>
            )}
            {recording.compositeRecordingTemplate && (
              <p
                className="text-xs mt-2"
                style={{ color: "rgba(255,255,255,0.42)", fontFamily: "monospace" }}
              >
                Composite: {truncateMiddle(recording.compositeRecordingTemplate, 68)}
              </p>
            )}
          </div>
        )}
      </div>

      {analysisSummary && (
        <div
          className="rounded-2xl px-3 py-2 text-xs"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            color: "rgba(170,245,195,0.92)",
          }}
        >
          {analysisSummary}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <button
          type="button"
          onClick={() => onPreview(recording)}
          disabled={isBusy}
          className="px-3 py-2 rounded-2xl text-xs transition-opacity hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
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
            background: "rgba(30,107,255,0.2)",
            border: "1px solid rgba(79,179,255,0.28)",
            color: "#90caff",
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
            background: "rgba(245,158,11,0.16)",
            border: "1px solid rgba(245,158,11,0.24)",
            color: "#f7c56d",
            cursor: canAnalyze ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {busyAction === "analyze"
            ? "Running..."
            : selectedClassesCount > 0
              ? `Run AI (${selectedClassesCount})`
              : "Run AI"}
        </button>
      </div>
    </div>
  );
}

function AnalysisJobCard({
  job,
  loading,
  onRefresh,
  onOpenClassPreview,
}: {
  job: RecordingAnalysisJob;
  loading: boolean;
  onRefresh: (jobId: string) => void;
  onOpenClassPreview: (job: RecordingAnalysisJob, label: string, subJobId: string | null) => void;
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
      className="rounded-3xl p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-medium text-sm">{job.jobId}</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
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
              background: "rgba(79,179,255,0.14)",
              border: "1px solid rgba(79,179,255,0.22)",
              color: "#90caff",
            }}
          >
            {formatClassLabel(label)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.35)" }}>Created</p>
          <p className="mt-1">{formatDate(job.createdAt)}</p>
        </div>
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.35)" }}>Completed</p>
          <p className="mt-1">
            {job.completedAt ? formatDate(job.completedAt) : "Still running"}
          </p>
        </div>
      </div>

      {job.selectedObjectKey && (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
          File: {truncateMiddle(job.selectedObjectKey, 74)}
        </p>
      )}

      {subJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {subJobs.map((subJob) => {
            const subTone = getStatusTone(subJob.state);
            const moments = getClassDetectionMoments(job, subJob.label);
            const canPreviewClass = previewEnabled && (moments.length > 0 || subJob.jobId != null);
            return (
              <div
                key={`${job.jobId}-${subJob.label}`}
                className="rounded-2xl px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white">{formatClassLabel(subJob.label)}</span>
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
                {subJob.jobId && (
                  <p
                    className="text-[11px] mt-2"
                    style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}
                  >
                    {subJob.jobId}
                  </p>
                )}
                {subJob.lastError && (
                  <p className="text-[11px] mt-2" style={{ color: "rgba(255,170,170,0.92)" }}>
                    {subJob.lastError}
                  </p>
                )}
                {canPreviewClass && (
                  <button
                    type="button"
                    onClick={() => onOpenClassPreview(job, subJob.label, subJob.jobId)}
                    className="mt-3 px-3 py-2 rounded-2xl text-[11px] transition-opacity hover:opacity-80"
                    style={{
                      background: "rgba(30,107,255,0.18)",
                      border: "1px solid rgba(79,179,255,0.26)",
                      color: "#90caff",
                      cursor: "pointer",
                    }}
                  >
                    Preview {formatClassLabel(subJob.label)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
      className="rounded-3xl p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-medium text-sm">{job.jobId}</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
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

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.35)" }}>Frames</p>
          <p className="mt-1">{job.framesProcessed ?? 0}</p>
        </div>
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.35)" }}>Events</p>
          <p className="mt-1">{job.eventsWritten ?? 0}</p>
        </div>
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
  const { setCurrentPage } = useAppContext();
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

  async function openClassPreview(
    job: RecordingAnalysisJob,
    label: string,
    subJobId: string | null,
  ) {
    const moments = getClassDetectionMoments(job, label);
    const matchedRecording =
      recordings.find((recording) => recording.id === job.recordingDetailId) ?? null;

    resetClassPreview();
    setClassPreview({
      job,
      recording: matchedRecording,
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
      let recordingDownloadError: string | null = null;

      if (matchedRecording) {
        const selectedFilename = job.selectedObjectKey
          ? fileNameFromKey(job.selectedObjectKey)
          : undefined;
        try {
          const file = await downloadRecordingFile(matchedRecording.id, {
            folderName: matchedRecording.folderName,
            filename: selectedFilename,
          });
          const objectUrl = window.URL.createObjectURL(file.blob);
          classPreviewUrlRef.current = objectUrl;

          setClassPreview((current) => ({
            ...current,
            loading: false,
            mediaType: "video",
            mediaUrl: objectUrl,
            mediaFilename: file.filename,
            note:
              moments.length > 0
                ? "Showing the original recording with saved bounding boxes overlaid for the selected violation moment."
                : "Showing the source recording. No saved bounding boxes were found for this class in the aggregate result.",
          }));
          return;
        } catch (downloadError) {
          recordingDownloadError =
            downloadError instanceof Error ? downloadError.message : "Failed to download source recording.";
        }
      }

      if (subJobId) {
        const previewBlob = await fetchAiJobPreview(subJobId);
        const objectUrl = window.URL.createObjectURL(previewBlob);
        classPreviewUrlRef.current = objectUrl;

        setClassPreview((current) => ({
          ...current,
          loading: false,
          mediaType: "image",
          mediaUrl: objectUrl,
          mediaFilename: `${subJobId}.jpg`,
          note:
            recordingDownloadError
              ? `The source recording could not be downloaded, so this is the detector preview image fallback. ${recordingDownloadError}`
              : "Original recording metadata was not available in the current list, so this is the detector preview image fallback.",
        }));
        return;
      }

      setClassPreview((current) => ({
        ...current,
        loading: false,
        error: recordingDownloadError ?? "This class has no previewable source available yet.",
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

        @font-face {
          font-family: 'Ethnocentric';
          src: url('https://db.onlinewebfonts.com/t/4f212c96840b7c759cb0e61720d2c2c5.woff2') format('woff2'),
               url('https://db.onlinewebfonts.com/t/4f212c96840b7c759cb0e61720d2c2c5.woff') format('woff');
          font-weight: normal;
          font-style: normal;
        }

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
              className="px-3 py-2 rounded-xl text-xs transition-opacity hover:opacity-80"
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
              onClick={() => navigate(-1)}
              className="px-3 py-2 rounded-xl text-xs transition-opacity hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.72)",
                cursor: "pointer",
              }}
            >
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
                  Database-backed recording metadata with on-demand secure download and AI analysis.
                </p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Showing {recordings.length} of {total} entries in{" "}
                  {ROOT_OPTIONS.find((option) => option.value === recordingRoot)?.label}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROOT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRecordingRoot(option.value)}
                    className="text-left rounded-3xl px-4 py-3 transition-all duration-150"
                    style={{
                      background:
                        recordingRoot === option.value
                          ? "linear-gradient(to bottom, rgba(30,107,255,0.22), rgba(79,179,255,0.1))"
                          : "rgba(255,255,255,0.04)",
                      border: `1px solid ${
                        recordingRoot === option.value
                          ? "rgba(79,179,255,0.32)"
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
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>
                      {option.hint}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleApplyFilters}
              className="rounded-[28px] p-4"
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
                    Room ID
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
                    Folder name
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
                      background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                      color: "#0a20bb",
                      fontFamily: "'Ethnocentric', sans-serif",
                      letterSpacing: "0.04em",
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

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
              <section
                className="rounded-[28px] p-5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-white font-medium">AI Detection Classes</h2>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Choose the classes that each recording analysis job should run as separate subjobs.
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
                    className="px-3 py-2 rounded-2xl text-xs"
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
                              ? "rgba(79,179,255,0.18)"
                              : "rgba(255,255,255,0.05)",
                            border: `1px solid ${
                              selected ? "rgba(79,179,255,0.34)" : "rgba(255,255,255,0.1)"
                            }`,
                            color: selected ? "#90caff" : "rgba(255,255,255,0.7)",
                            cursor: "pointer",
                          }}
                        >
                          {selected ? "Selected: " : ""}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div
                    className="rounded-2xl p-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>
                      MODEL PATH
                    </p>
                    <p
                      className="mt-2 text-xs"
                      style={{ color: "rgba(255,255,255,0.76)", fontFamily: "monospace" }}
                    >
                      {modelPath || "Unknown"}
                    </p>
                  </div>
                  <div
                    className="rounded-2xl p-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>
                      MODEL CLASSES
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.76)" }}>
                      {modelClasses.length} available in the loaded model
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>
                      {selectedClasses.length} class{selectedClasses.length === 1 ? "" : "es"} selected for analysis
                    </p>
                  </div>
                </div>
              </section>

              <section
                className="rounded-[28px] p-5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-white font-medium">Jobs Monitor</h2>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Tracks live detector jobs and aggregate recording-analysis jobs from the backend.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setJobsRefreshKey((value) => value + 1)}
                      className="px-3 py-2 rounded-2xl text-xs"
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
                </div>

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

                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="px-2.5 py-1 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.78)",
                      }}
                    >
                      Detector: {jobsStatus?.counts.detectorJobs ?? 0}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.78)",
                      }}
                    >
                      Aggregate: {jobsStatus?.counts.recordingAnalysisJobs ?? 0}
                    </span>
                  </div>
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
                      {(jobsStatus?.recordingAnalysisJobs ?? []).length === 0 && (
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.34)" }}>
                          No matching analysis jobs right now.
                        </p>
                      )}
                      {(jobsStatus?.recordingAnalysisJobs ?? []).map((job) => (
                        <AnalysisJobCard
                          key={job.jobId}
                          job={job}
                          loading={jobRefreshLoadingById[job.jobId] === true}
                          onRefresh={refreshAnalysisJob}
                          onOpenClassPreview={openClassPreview}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm text-white">Detector jobs</h3>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.36)" }}>
                        Live model workers
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {(jobsStatus?.detectorJobs ?? []).length === 0 && (
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.34)" }}>
                          No matching detector jobs right now.
                        </p>
                      )}
                      {(jobsStatus?.detectorJobs ?? []).map((job) => (
                        <DetectorJobCard key={job.jobId} job={job} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

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
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    onAnalyze={handleAnalyze}
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
