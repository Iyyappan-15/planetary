import * as THREE from 'three';

export type WeaponCategory = 'explosives' | 'lasers' | 'celestial' | 'alien' | 'monsters' | 'shields';

export type WeaponId =
  // Explosives & Missiles
  | 'nuclear_missile'
  | 'cluster_missiles'
  | 'antimatter_bomb'
  | 'stealth_bomber'
  | 'drilling_torpedo'
  | 'tectonic_disruptor'
  // Lasers & Energy
  | 'continuous_laser'
  | 'freeze_ray'
  | 'plasma_cannon'
  | 'laser_blade'
  | 'lightning_storm'
  | 'solar_mirror'
  // Celestial & Spacial
  | 'meteor_shower'
  | 'giant_asteroid'
  | 'moon_collision'
  | 'black_hole'
  | 'space_tear'
  | 'solar_flare'
  // Alien Technology
  | 'alien_ufo'
  | 'planet_destroyer'
  | 'shield_satellite'
  | 'harvester_probe'
  | 'shield_buster'
  | 'nanite_swarm'
  | 'antigravity_disruptor'
  | 'chunk_extractor'
  // Monsters & Titans
  | 'space_worm'
  | 'celestial_punch'
  | 'abyssal_devourer'
  | 'cosmic_dragon'
  | 'celestial_sword'
  // Aliases for compatibility
  | 'meteor'
  | 'orbital_laser'
  | 'nuclear_blast'
  | 'gravity_well'
  | 'plasma_beam'
  | 'mini_black_hole'
  | 'planetary_glassmaker'
  | 'moonfall';

export type ActiveWeaponId = WeaponId | null;

export interface TargetInfo {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  uv: { u: number; v: number };
  lat: number;
  lon: number;
  distance: number;
  targetType?: 'planet' | 'moon';
  targetMesh?: THREE.Object3D;
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
  requiresHold?: boolean; // For continuous weapons like Continuous Laser & Freeze Ray
}
