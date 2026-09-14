export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface AudioSettings {
  masterVolume: number; // 0..1
  effectsVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  muted: boolean;
}

export interface GraphicsSettings {
  quality: QualityLevel;
  pixelRatio: number;
  particlesEnabled: boolean;
  maxParticles: number;
  screenShake: boolean;
  bloom: boolean;
  atmosphere: boolean;
  clouds: boolean;
}

export interface GameSettings {
  graphics: GraphicsSettings;
  audio: AudioSettings;
  cameraSensitivity: number;
}

export interface PopulationState {
  current: number;
  initial: number;
  casualties: number;
  lastCasualties: number;
  survivalRate: number; // 0..100
}

export interface PlanetIntegrity {
  currentHp: number;
  maxHp: number;
  percentage: number;
  isBroken: boolean;
  impactCount: number;
  population: PopulationState;
}
