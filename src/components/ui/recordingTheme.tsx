import type { CSSProperties } from "react";

export const recordingThemePageStyle: CSSProperties = {
  background: "linear-gradient(160deg, #07111f 0%, #060d1c 50%, #040a18 100%)",
  fontFamily: "'DM Sans', sans-serif",
};

export const recordingThemeSurfaceStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 60px rgba(2,8,22,0.36)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

export const recordingThemeSurfaceStrongStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 28px 70px rgba(2,8,22,0.42)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

export const recordingThemePillButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

export const recordingThemeDangerPillButtonStyle: CSSProperties = {
  background: "rgba(127,29,29,0.28)",
  border: "1px solid rgba(248,113,113,0.24)",
  color: "rgba(254,202,202,0.88)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

export const recordingThemePrimaryButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, #a8dcff 0%, #78beff 100%)",
  border: "1px solid rgba(186,228,255,0.48)",
  color: "#04121f",
  boxShadow: "0 16px 36px rgba(36,114,183,0.22)",
};

export const recordingThemeSecondaryButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.86)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

export const recordingThemeSecondaryActiveButtonStyle: CSSProperties = {
  background: "rgba(79,179,255,0.14)",
  border: "1px solid rgba(79,179,255,0.28)",
  color: "#90caff",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

export const recordingThemeMutedTextStyle: CSSProperties = {
  color: "rgba(255,255,255,0.58)",
};

export const recordingThemeSubtleTextStyle: CSSProperties = {
  color: "rgba(255,255,255,0.36)",
};

export const recordingThemeErrorTextStyle: CSSProperties = {
  color: "rgba(254,202,202,0.92)",
};

export function getRecordingThemeInputStyle(
  focused: boolean,
  hasError: boolean,
): CSSProperties {
  if (hasError) {
    return {
      background: "rgba(127,29,29,0.24)",
      border: "1px solid rgba(248,113,113,0.34)",
      boxShadow: "0 0 0 3px rgba(248,113,113,0.08)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    };
  }

  if (focused) {
    return {
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(124,189,255,0.36)",
      boxShadow: "0 0 0 3px rgba(79,179,255,0.12)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    };
  }

  return {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "none",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  };
}

export function RecordingThemeBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, #07111f 0%, #060d1c 50%, #040a18 100%)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: "8%",
          left: "-12%",
          width: 420,
          height: 420,
          background: "rgba(79,179,255,0.16)",
          filter: "blur(110px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: "-10%",
          right: "-8%",
          width: 520,
          height: 520,
          background: "rgba(43,92,186,0.18)",
          filter: "blur(120px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: "34%",
          right: "22%",
          width: 240,
          height: 240,
          background: "rgba(108,153,255,0.1)",
          filter: "blur(90px)",
        }}
      />
    </div>
  );
}
