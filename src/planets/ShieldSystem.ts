import * as THREE from 'three';
import { ShieldConfig, ShieldType, ActiveShieldState } from '../types/shield';
import { SHIELD_DEFINITIONS } from '../data/shields';
import { ImpactData } from '../types/planet';
import { ParticleSystem } from '../effects/ParticleSystem';
import { AudioManager } from '../audio/AudioManager';
import { CameraController } from '../renderer/CameraController';
import { disposeNode } from '../utils/disposal';

export interface ShieldContext {
  scene: THREE.Scene;
  particleSystem: ParticleSystem;
  audioManager: AudioManager;
  cameraController: CameraController;
}

export class ShieldSystem {
  private planetRadius: number;
  public activeConfig: ShieldConfig | null = null;
  public currentHp: number = 0;
  public mesh: THREE.Mesh | null = null;
  public secondaryMesh: THREE.Mesh | null = null;
  private onStateChange?: (state: ActiveShieldState | null) => void;

  // Impact ripple uniforms / parameters
  private rippleCenter: THREE.Vector3 = new THREE.Vector3();
  private rippleProgress: number = 1.0; // 0..1 ripple expansion

  constructor(planetRadius: number, onStateChange?: (state: ActiveShieldState | null) => void) {
    this.planetRadius = planetRadius;
    this.onStateChange = onStateChange;
  }

  public get isActive(): boolean {
    return this.activeConfig !== null && this.currentHp > 0;
  }

  public getState(): ActiveShieldState | null {
    if (!this.activeConfig || this.currentHp <= 0) return null;
    return {
      id: this.activeConfig.id,
      name: this.activeConfig.name,
      currentHp: Math.max(0, Math.round(this.currentHp)),
      maxHp: this.activeConfig.maxHp,
      percentage: Math.max(0, Math.min(100, Math.round((this.currentHp / this.activeConfig.maxHp) * 100))),
      color: this.activeConfig.color,
      glowColor: this.activeConfig.glowColor,
    };
  }

  public deploy(type: ShieldType, context: ShieldContext): void {
    // If shield already exists, dispose it first
    this.remove(context.scene);

    const config = SHIELD_DEFINITIONS.find((s) => s.id === type) || SHIELD_DEFINITIONS[0];
    this.activeConfig = config;
    this.currentHp = config.maxHp;

    const shieldRadius = this.planetRadius * 1.15;

    // 1. Primary Shield Mesh
    if (type === 'hex_barrier') {
      const geo = new THREE.IcosahedronGeometry(shieldRadius, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        roughness: 0.1,
        metalness: 0.8,
      });
      this.mesh = new THREE.Mesh(geo, mat);

      // Inner soft energy glow sphere
      const innerGeo = new THREE.SphereGeometry(shieldRadius * 0.99, 32, 32);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x00aacc,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      this.secondaryMesh = new THREE.Mesh(innerGeo, innerMat);
    } else if (type === 'plasma_deflector') {
      const geo = new THREE.SphereGeometry(shieldRadius, 48, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff5500,
        emissiveIntensity: 0.6,
        wireframe: false,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        roughness: 0.2,
      });
      this.mesh = new THREE.Mesh(geo, mat);

      // Outer plasma field shell
      const outerGeo = new THREE.IcosahedronGeometry(shieldRadius * 1.02, 3);
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      this.secondaryMesh = new THREE.Mesh(outerGeo, outerMat);
    } else if (type === 'magnetic_aegis') {
      const geo = new THREE.SphereGeometry(shieldRadius, 40, 40);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x3388ff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      this.mesh = new THREE.Mesh(geo, mat);

      // Rotating electromagnetic latitude flux ring
      const ringGeo = new THREE.TorusGeometry(shieldRadius * 1.03, 0.03, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x55aaff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      this.secondaryMesh = new THREE.Mesh(ringGeo, ringMat);
    } else {
      // Celestial Void Ward
      const geo = new THREE.IcosahedronGeometry(shieldRadius, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xaa22ff,
        emissive: 0x6600cc,
        emissiveIntensity: 0.7,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });
      this.mesh = new THREE.Mesh(geo, mat);

      const innerGeo = new THREE.SphereGeometry(shieldRadius * 0.99, 32, 32);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x550088,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
      });
      this.secondaryMesh = new THREE.Mesh(innerGeo, innerMat);
    }

    if (this.mesh) context.scene.add(this.mesh);
    if (this.secondaryMesh) context.scene.add(this.secondaryMesh);

    // Initial deployment ripple & sound
    context.audioManager.playShieldDeflect();
    context.particleSystem.emit(
      new THREE.Vector3(0, shieldRadius, 0),
      new THREE.Vector3(0, 1, 0),
      40,
      config.color,
      1.5,
      3.5,
      0.8,
      0.5
    );

    this.notifyState();
  }

  /**
   * Intercepts an impact, deals damage to the shield, and protects the planet underneath.
   * Returns true if damage was absorbed, or false if no shield is active.
   */
  public absorbImpact(impact: ImpactData, context: ShieldContext): boolean {
    if (!this.isActive || !this.activeConfig) return false;

    // Base damage calculation proportionate to impact radius & intensity
    let baseDamage = impact.intensity * (impact.radius / 0.05) * 140;
    if (baseDamage < 20) baseDamage = 20;

    // Apply shield resistance modifiers
    if (this.activeConfig.resistanceType === 'energy') {
      if (impact.type === 'laser' || impact.type === 'freeze') {
        baseDamage *= 0.5; // 50% laser absorption bonus
      }
    } else if (this.activeConfig.resistanceType === 'kinetic') {
      if (!impact.type || impact.type === 'blast') {
        baseDamage *= 0.5; // 50% kinetic absorption bonus
      }
    } else if (this.activeConfig.resistanceType === 'cosmic') {
      baseDamage *= 0.65; // High overall mitigation
    }

    this.currentHp -= baseDamage;

    // Impact location on shield
    this.rippleCenter.copy(impact.position).normalize().multiplyScalar(this.planetRadius * 1.15);
    this.rippleProgress = 0.0;

    // Deflection visual & audio effects
    context.audioManager.playShieldDeflect();
    context.cameraController.addTrauma(0.1);
    context.particleSystem.emit(
      this.rippleCenter,
      impact.position.clone().normalize(),
      25,
      this.activeConfig.color,
      0.8,
      2.2,
      0.5,
      0.3
    );

    // Check for shield destruction
    if (this.currentHp <= 0) {
      this.shatter(context);
    } else {
      this.notifyState();
    }

    return true; // Damage successfully absorbed
  }

  private shatter(context: ShieldContext): void {
    if (!this.activeConfig) return;

    // Catastrophic shield shatter particle burst
    const shardCount = 90;
    const center = new THREE.Vector3(0, 0, 0);
    context.particleSystem.emit(
      center,
      new THREE.Vector3(0, 1, 0),
      shardCount,
      this.activeConfig.color,
      3.0,
      6.0,
      1.8,
      0.9
    );

    context.cameraController.addTrauma(0.4);
    context.audioManager.playNuclearDetonation();

    this.remove(context.scene);
  }

  public update(delta: number): void {
    if (!this.isActive || !this.mesh) return;

    // Slowly rotate shield structure
    this.mesh.rotation.y += delta * 0.25;
    this.mesh.rotation.x += delta * 0.12;

    if (this.secondaryMesh) {
      this.secondaryMesh.rotation.y -= delta * 0.35;
      this.secondaryMesh.rotation.z += delta * 0.18;
    }

    // Impact ripple animation
    if (this.rippleProgress < 1.0) {
      this.rippleProgress += delta * 3.5;
      // Pulse scale slightly on hit
      const rippleBump = Math.sin(this.rippleProgress * Math.PI) * 0.04;
      this.mesh.scale.set(1 + rippleBump, 1 + rippleBump, 1 + rippleBump);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    // Health-based opacity flicker when damaged
    const hpRatio = this.currentHp / (this.activeConfig?.maxHp || 1);
    if (this.mesh.material instanceof THREE.Material) {
      const baseOpacity = 0.4 + hpRatio * 0.25;
      const flicker = hpRatio < 0.3 ? (Math.random() - 0.5) * 0.15 : 0;
      this.mesh.material.opacity = Math.max(0.15, baseOpacity + flicker);
    }
  }

  public remove(scene: THREE.Scene): void {
    if (this.mesh) {
      scene.remove(this.mesh);
      disposeNode(this.mesh);
      this.mesh = null;
    }
    if (this.secondaryMesh) {
      scene.remove(this.secondaryMesh);
      disposeNode(this.secondaryMesh);
      this.secondaryMesh = null;
    }
    this.activeConfig = null;
    this.currentHp = 0;
    this.notifyState();
  }

  private notifyState(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  public dispose(scene: THREE.Scene): void {
    this.remove(scene);
  }
}
