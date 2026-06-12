import { useMemo, useState } from "react";
import VideoTile, { type Participant } from "./VideoTile";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VideoGridProps {
  participants: Participant[];
  /** Override layout: auto | spotlight | grid | sidebar */
  layout?: "auto" | "spotlight" | "grid" | "sidebar";
  className?: string;
}

// ─── Layout engine ────────────────────────────────────────────────────────────
function getGridStyle(count: number): React.CSSProperties {
  let columns = 1;

  if (count === 2) {
    columns = 2;
  } else if (count <= 4) {
    columns = 2;
  } else if (count <= 9) {
    columns = 3;
  } else {
    columns = 4;
  }

  const rows = Math.max(1, Math.ceil(count / columns));

  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    gridAutoRows: "minmax(0, 1fr)",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
function VideoGrid({
  participants,
  layout = "auto",
  className = "",
}: VideoGridProps) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const pinned = useMemo(
    () => participants.find((p) => p.id === pinnedId) ?? null,
    [participants, pinnedId]
  );
  const rest = useMemo(
    () => participants.filter((p) => p.id !== pinnedId),
    [participants, pinnedId]
  );

  // Resolve effective layout
  const effectiveLayout = useMemo(() => {
    if (layout !== "auto") return layout;
    if (pinnedId) return "spotlight";
    return "grid";
  }, [layout, pinnedId]);

  function handlePin(id: string) {
    setPinnedId((prev) => (prev === id ? null : id));
  }

  // ── Spotlight layout ──
  if (effectiveLayout === "spotlight" && pinned) {
    return (
      <div
        className={`flex flex-col gap-3 w-full h-full ${className}`}
        style={{ minHeight: 0 }}
      >
        {/* Main pinned tile */}
        <div className="flex-1 min-h-0">
          <VideoTile
            participant={pinned}
            isPinned
            onPin={handlePin}
            className="w-full h-full"
            style={{ height: "100%" }}
          />
        </div>

        {/* Strip of remaining participants */}
        {rest.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ height: 90, flexShrink: 0 }}
          >
            {rest.map((p) => (
              <VideoTile
                key={p.id}
                participant={p}
                onPin={handlePin}
                style={{ width: 144, minWidth: 144, height: 90 }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Sidebar layout ──
  if (effectiveLayout === "sidebar") {
    const [main, ...others] = participants;
    return (
      <div className={`flex gap-3 w-full h-full ${className}`} style={{ minHeight: 0 }}>
        {main && (
          <div className="flex-1 min-w-0">
            <VideoTile
              participant={main}
              onPin={handlePin}
              isPinned={pinnedId === main.id}
              className="w-full h-full"
              style={{ height: "100%" }}
            />
          </div>
        )}
        {others.length > 0 && (
          <div
            className="flex flex-col gap-2 overflow-y-auto"
            style={{ width: 180, flexShrink: 0 }}
          >
            {others.map((p) => (
              <VideoTile
                key={p.id}
                participant={p}
                onPin={handlePin}
                isPinned={pinnedId === p.id}
                style={{ width: "100%", aspectRatio: "16/9" }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Grid layout (default) ──
  if (participants.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl ${className}`}
        style={{
          background: "rgba(10,18,40,0.6)",
          border: "1px solid rgba(255,255,255,0.07)",
          minHeight: 200,
        }}
      >
        <p className="text-white/30 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Waiting for participants…
        </p>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-3 w-full h-full min-h-0 ${className}`}
      style={getGridStyle(participants.length)}
    >
      {participants.map((p) => (
        <VideoTile
          key={p.id}
          participant={p}
          onPin={handlePin}
          isPinned={pinnedId === p.id}
          className="h-full min-h-0"
        />
      ))}
    </div>
  );
}

export default VideoGrid;
