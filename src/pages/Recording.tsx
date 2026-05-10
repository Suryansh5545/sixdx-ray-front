import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { formatRoomCode } from "../lib/meeting/roomCode";
import {
  analyzeRecording,
  DEFAULT_RECORDING_ANALYSIS_CLASSES,
  downloadRecordingFile,
  getRecordingAnalysisJobId,
  listRecordings,
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

function RecordingCard({
  recording,
  busyAction,
  analysisSummary,
  onPreview,
  onDownload,
  onAnalyze,
}: {
  recording: RecordingListItem;
  busyAction?: ActionKind;
  analysisSummary?: string;
  onPreview: (recording: RecordingListItem) => void;
  onDownload: (recording: RecordingListItem) => void;
  onAnalyze: (recording: RecordingListItem) => void;
}) {
  const isBusy = busyAction !== undefined;

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
          disabled={isBusy}
          className="px-3 py-2 rounded-2xl text-xs transition-opacity hover:opacity-80"
          style={{
            background: "rgba(245,158,11,0.16)",
            border: "1px solid rgba(245,158,11,0.24)",
            color: "#f7c56d",
            cursor: isBusy ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {busyAction === "analyze" ? "Running..." : "Run AI"}
        </button>
      </div>
    </div>
  );
}

export default function RecordingPage() {
  const navigate = useNavigate();
  const { setCurrentPage } = useAppContext();
  const previewUrlRef = useRef<string | null>(null);

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
  const [preview, setPreview] = useState<PreviewState>({
    recording: null,
    url: null,
    filename: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    setCurrentPage("recordings");
  }, [setCurrentPage]);

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
    updateBusyAction(recording.id, "analyze");

    try {
      const response = await analyzeRecording(recording.id, {
        folderName: recording.folderName,
        classes: DEFAULT_RECORDING_ANALYSIS_CLASSES,
        sourceName: `recording-${recording.folderName}`,
      });

      const jobId = getRecordingAnalysisJobId(response);
      const selectedFile = fileNameFromKey(response.selectedKey);
      const summary = jobId
        ? `AI job ${jobId} started for ${selectedFile}.`
        : `AI analysis started for ${selectedFile}.`;

      setAnalysisSummaryById((previous) => ({
        ...previous,
        [String(recording.id)]: summary,
      }));
      setBanner({
        kind: "success",
        text: summary,
      });
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
    </>
  );
}
