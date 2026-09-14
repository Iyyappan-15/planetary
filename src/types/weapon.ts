import * as THREE from 'three';

export type WeaponCategory = 'kinetic' | 'energy' | 'explosive' | 'gravity' | 'cosmic';

export type WeaponId =
  | 'meteor'
  | 'orbital_laser'
  | 'nuclear_blast'
  | 'gravity_well'
  // Extended weapons
  | 'giant_asteroid'
  | 'plasma_beam'
  | 'mini_black_hole'
  | 'space_tear'
  | 'planetary_glassmaker'
  | 'moonfall';

export interface TargetInfo {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  uv: { u: number; v: number };
  lat: number;
  lon: number;
  distance: number;
}

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  description: string;
  cooldownMs: number;
  iconName: string;
  keyShortcut?: string;
  damageRadius: number;
  damageIntensity: number;
  requiresHold?: boolean; // For continuous weapons like Orbital Laser
}
