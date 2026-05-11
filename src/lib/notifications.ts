import { fetchWithAuth } from "./auth";
import { buildServerUrl } from "./server";

export interface HseViolationEmailRequest {
  violationLabel: string;
  roomId?: string;
  folderName?: string;
  filename?: string;
  recordingDetailId?: number;
  analysisJobId?: string;
  detectedAt?: string;
  participantName?: string;
  participantIdentity?: string;
  location?: string;
  notes?: string;
  details?: Record<string, unknown>;
}

interface RawHseViolationEmailResponse {
  status?: string;
  recipient?: string;
  subject?: string;
  violation_label?: string;
  download_url?: string;
  attachment_included?: boolean;
}

export interface HseViolationEmailResponse {
  status: string;
  recipient: string | null;
  subject: string | null;
  violationLabel: string;
  downloadUrl: string | null;
  attachmentIncluded: boolean;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDownloadUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return buildServerUrl(trimmed);
}

async function readErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // Ignore parse failures and use the fallback.
  }

  return fallback;
}

export async function sendHseViolationEmail(
  payload: HseViolationEmailRequest,
): Promise<HseViolationEmailResponse> {
  const response = await fetchWithAuth("/notifications/hse-violations/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      violation_label: payload.violationLabel.trim(),
      room_id: normalizeOptionalString(payload.roomId)?.toUpperCase(),
      folder_name: normalizeOptionalString(payload.folderName),
      filename: normalizeOptionalString(payload.filename),
      recording_detail_id: payload.recordingDetailId,
      analysis_job_id: normalizeOptionalString(payload.analysisJobId),
      detected_at: normalizeOptionalString(payload.detectedAt),
      participant_name: normalizeOptionalString(payload.participantName),
      participant_identity: normalizeOptionalString(payload.participantIdentity),
      location: normalizeOptionalString(payload.location),
      notes: normalizeOptionalString(payload.notes),
      details: payload.details,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorDetail(response, "Failed to queue the HSE violation email."));
  }

  const data = (await response.json()) as RawHseViolationEmailResponse;
  return {
    status: typeof data.status === "string" ? data.status : "queued",
    recipient: typeof data.recipient === "string" ? data.recipient : null,
    subject: typeof data.subject === "string" ? data.subject : null,
    violationLabel:
      typeof data.violation_label === "string" && data.violation_label.trim()
        ? data.violation_label
        : payload.violationLabel,
    downloadUrl: normalizeDownloadUrl(data.download_url),
    attachmentIncluded: data.attachment_included === true,
  };
}
