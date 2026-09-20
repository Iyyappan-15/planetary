import * as THREE from 'three';
import { TargetInfo, WeaponConfig } from '../types/weapon';
import { Planet } from '../planets/Planet';
import { ParticleSystem } from '../effects/ParticleSystem';
import { ShockwaveSystem } from '../effects/Shockwave';
import { CameraController } from '../renderer/CameraController';
import { AudioManager } from '../audio/AudioManager';

export interface WeaponContext {
  scene: THREE.Scene;
  planet: Planet;
  cameraController: CameraController;
  particleSystem: ParticleSystem;
  shockwaveSystem: ShockwaveSystem;
  audioManager: AudioManager;
  moonMesh?: THREE.Mesh | null;
  moonMeshes?: THREE.Mesh[];
  moonSystem?: any;
}

export abstract class Weapon {
  public config: WeaponConfig;
  protected lastFiredTime: number = 0;

  constructor(config: WeaponConfig) {
    this.config = config;
  }

  public canFire(): boolean {
    return performance.now() - this.lastFiredTime >= this.config.cooldownMs;
  }

  public abstract execute(target: TargetInfo, context: WeaponContext): void;

  public abstract update(delta: number, context: WeaponContext): void;

  public preview(_target: TargetInfo | null, _context: WeaponContext): void {
    // Optional visual preview
  }

  public stopContinuous(_context: WeaponContext): void {
    // For hold-to-fire weapons like lasers
  }

  public dispose(): void {
    // Cleanup any weapon meshes
  }
}
