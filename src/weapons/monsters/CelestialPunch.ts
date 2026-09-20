import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActivePunch {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
}

export class CelestialPunchWeapon extends Weapon {
  private activePunches: ActivePunch[] = [];

  constructor() {
    super({
      id: 'celestial_punch',
      name: 'Celestial Punch',
      category: 'monsters',
      description: 'Titanic glowing cosmic fist manifesting from the cosmos and delivering an almighty punch into the planet.',
      cooldownMs: 2200,
      iconName: 'HandMetal',
      damageRadius: 0.2,
      damageIntensity: 1.7,
    });
  }

  private createFistMesh(): THREE.Group {
    const group = new THREE.Group();

    // Cosmic fist palm
    const palmGeo = new THREE.BoxGeometry(0.7, 0.45, 0.8);
    const fistMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.8,
    });
    const palm = new THREE.Mesh(palmGeo, fistMat);
    group.add(palm);

    // 4 Curled fingers
    for (let i = 0; i < 4; i++) {
      const fingerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
      const finger = new THREE.Mesh(fingerGeo, fistMat);
      finger.rotation.z = Math.PI / 2;
      finger.position.set(0.35, -0.15 + i * 0.12 - 0.18, 0.35);
      group.add(finger);
    }

    // Folded thumb
    const thumbGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.4, 8);
    const thumb = new THREE.Mesh(thumbGeo, fistMat);
    thumb.position.set(0.2, 0.22, 0.1);
    group.add(thumb);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 8.0);
    const group = this.createFistMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activePunches.push({
      group,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
    });

    context.audioManager.playCelestialPunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activePunches.length - 1; i >= 0; i--) {
      const p = this.activePunches[i];
      p.progress += delta * 2.2; // ~0.45s punch

      if (p.progress >= 1.0) {
        this.onImpact(p, context);
        context.scene.remove(p.group);
        disposeNode(p.group);
        this.activePunches.splice(i, 1);
        continue;
      }

      // Accelerate towards ground
      const easeIn = p.progress * p.progress;
      p.group.position.lerpVectors(p.startPos, p.targetPos, easeIn);

      // Golden cosmic aura
      context.particleSystem.emit(
        p.group.position,
        p.targetNormal,
        3,
        '#ffaa00',
        0.3,
        1.0,
        0.3,
        0.2
      );
    }
  }

  private onImpact(p: ActivePunch, context: WeaponContext): void {
    context.planet.registerImpact({
      u: p.targetUV.u,
      v: p.targetUV.v,
      lat: p.targetLat,
      lon: p.targetLon,
      position: p.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.9,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(p.targetPos, p.targetNormal, context.planet.config.radius * 0.75, '#ffaa00');
    context.particleSystem.emit(p.targetPos, p.targetNormal, 70, '#ff7700', 2.2, 5.5, 1.6, 0.85);
    context.cameraController.addTrauma(0.55);
    context.audioManager.playCelestialPunch();
  }

  public dispose(): void {
    for (const p of this.activePunches) {
      disposeNode(p.group);
    }
    this.activePunches = [];
  }
}
