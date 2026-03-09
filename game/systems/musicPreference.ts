import type Phaser from "phaser";

const MUSIC_ENABLED_STORAGE_KEY = "moc_music_enabled";
const MUSIC_ENABLED_DEFAULT = false;
const MUSIC_TOGGLE_ON_COLOR = "#d4d4d4";
const MUSIC_TOGGLE_OFF_COLOR = "#8a8a8a";

export function readMusicEnabledPreference(): boolean {
  if (typeof window === "undefined") {
    return MUSIC_ENABLED_DEFAULT;
  }

  try {
    const rawValue = window.localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY);
    if (rawValue === null) {
      return MUSIC_ENABLED_DEFAULT;
    }
    if (rawValue === "1" || rawValue.toLowerCase() === "true") {
      return true;
    }
    if (rawValue === "0" || rawValue.toLowerCase() === "false") {
      return false;
    }
    return MUSIC_ENABLED_DEFAULT;
  } catch {
    return MUSIC_ENABLED_DEFAULT;
  }
}

export function writeMusicEnabledPreference(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage errors to keep gameplay stable.
  }
}

export function toggleMusicEnabledPreference(): boolean {
  const nextValue = !readMusicEnabledPreference();
  writeMusicEnabledPreference(nextValue);
  return nextValue;
}

export function formatMusicToggleLabel(enabled: boolean): string {
  return `♪ ${enabled ? "ON" : "OFF"}`;
}

export function updateMusicToggleText(textObject: Phaser.GameObjects.Text): boolean {
  const enabled = readMusicEnabledPreference();
  textObject.setText(formatMusicToggleLabel(enabled));
  textObject.setColor(enabled ? MUSIC_TOGGLE_ON_COLOR : MUSIC_TOGGLE_OFF_COLOR);
  return enabled;
}
