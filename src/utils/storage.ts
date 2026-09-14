import { GameSettings } from '../types/game';

const SETTINGS_KEY = 'planetary-settings-v1';

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    quality: 'high',
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    particlesEnabled: true,
    maxParticles: 800,
    screenShake: true,
    bloom: true,
    atmosphere: true,
    clouds: true,
  },
  audio: {
    masterVolume: 0.8,
    effectsVolume: 0.85,
    ambienceVolume: 0.6,
    muted: false,
  },
  cameraSensitivity: 1.0,
};

export function loadStoredSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      graphics: { ...DEFAULT_SETTINGS.graphics, ...(parsed.graphics || {}) },
      audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota or disabled storage
  }
}
