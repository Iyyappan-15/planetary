import * as THREE from 'three';

export type PlanetCategory = 'solar_tier1' | 'solar_tier2' | 'fictional';
export type SurfaceType = 'earth_like' | 'rocky_desert' | 'gas_giant' | 'ice_world' | 'volcanic' | 'oceanic' | 'star';

export interface SurfaceProfile {
  type: SurfaceType;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  roughness: number;
  metalness: number;
  bumpScale?: number;
  hasOcean?: boolean;
  oceanColor?: string;
  specularColor?: string;
  hasCityLights?: boolean;
  seed: number;
}

export interface AtmosphereProfile {
  enabled: boolean;
  color: string;
  density: number;
  glowIntensity: number;
  rimPower: number;
  isStar?: boolean;
}

export interface CloudProfile {
  enabled: boolean;
  color: string;
  opacity: number;
  speed: number;
  altitude: number; // offset from surface radius (e.g. 0.02)
  seed: number;
}

export interface RingProfile {
  enabled: boolean;
  innerRadius: number;
  outerRadius: number;
  color: string;
  opacity: number;
  particleDensity?: number;
}

export interface DestructionProfile {
  resistance: number; // 1.0 is standard earth
  coreColor: string; // molten mantle glow color
  chunkCount: number; // e.g. 16 or 24 fracture chunks
}

export interface PlanetConfig {
  id: string;
  name: string;
  category: PlanetCategory;
  tagline: string;
  description: string;
  radius: number;
  rotationSpeed: number;
  isStar?: boolean;
  surface: SurfaceProfile;
  atmosphere: AtmosphereProfile;
  clouds?: CloudProfile;
  rings?: RingProfile;
  destruction: DestructionProfile;
  initialPopulation: number;
}

export interface ImpactData {
  u: number;
  v: number;
  lat?: number;
  lon?: number;
  position: THREE.Vector3;
  radius: number; // in UV/world units
  intensity: number; // 0..1
  heat: number; // 0..1 molten glow
  timestamp: number;
  type?: 'blast' | 'freeze' | 'laser';
}

