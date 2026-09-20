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
  hasImpacted: boolean;
  lingerTimer: number;
}

export class CelestialPunchWeapon extends Weapon {
  private activePunches: ActivePunch[] = [];

  constructor() {
    super({
      id: 'celestial_punch',
      name: 'Celestial Punch',
      category: 'monsters',
      description: 'Titanic cosmic fist manifesting from the cosmos and delivering a seismic punch into the planetary crust.',
      cooldownMs: 2500,
      iconName: 'Hand',
      damageRadius: 0.12,
      damageIntensity: 1.0,
    });
  }

  private createFistMesh(): THREE.Group {
    const group = new THREE.Group();

    // 1. Central knuckle block
    const knuckleGeo = new THREE.BoxGeometry(0.7, 0.45, 0.55);
    const knuckleMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
    });
    const knuckle = new THREE.Mesh(knuckleGeo, knuckleMat);
    group.add(knuckle);

    // 2. 4 Clenched metallic fingers
    for (let f = 0; f < 4; f++) {
      const fingerGeo = new THREE.BoxGeometry(0.14, 0.4, 0.25);
      const finger = new THREE.Mesh(fingerGeo, knuckleMat);
      finger.position.set(-0.25 + f * 0.16, -0.15, 0.32);
      group.add(finger);
    }

    // 3. Thumb folded across knuckles
    const thumbGeo = new THREE.BoxGeometry(0.45, 0.16, 0.25);
    const thumb = new THREE.Mesh(thumbGeo, knuckleMat);
    thumb.position.set(-0.15, 0.22, 0.28);
    thumb.rotation.z = -0.3;
    group.add(thumb);

    // 4. Cosmic forearm segment
    const armGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.8, 16);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xcc6600,
      emissive: 0x882200,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7,
    });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0, 0, -1.0);
    arm.rotation.x = Math.PI / 2;
    group.add(arm);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 8.5);
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
      hasImpacted: false,
      lingerTimer: 2.2, // Stays planted for 2.2 seconds!
    });

    context.audioManager.playCelestialPunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activePunches.length - 1; i >= 0; i--) {
      const p = this.activePunches[i];

      if (!p.hasImpacted) {
        // Grand, deliberate cosmic punch acceleration (~1.4s flight)
        p.progress += delta * 0.72;

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

        if (p.progress >= 1.0) {
          p.hasImpacted = true;
          p.group.position.copy(p.targetPos);
          this.onImpact(p, context);
        }
      } else {
        // Lingering impact state: Fist stays planted with smoke and energy radiating
        p.lingerTimer -= delta;

        // Radiating heat sparks from impact crater
        if (Math.random() < 0.3) {
          context.particleSystem.emit(
            p.targetPos,
            p.targetNormal,
            2,
            '#ff8800',
            0.4,
            1.5,
            0.3,
            0.2
          );
        }

        // Final 0.7s: Dissipate smoothly into cosmic stardust
        if (p.lingerTimer <= 0.7) {
          const fadeProgress = Math.max(0, p.lingerTimer / 0.7);
          p.group.scale.set(fadeProgress, fadeProgress, fadeProgress);
        }

        if (p.lingerTimer <= 0) {
          context.scene.remove(p.group);
          disposeNode(p.group);
          this.activePunches.splice(i, 1);
        }
      }
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

    context.shockwaveSystem.create(p.targetPos, p.targetNormal, context.planet.config.radius * 0.85, '#ffaa00');
    context.particleSystem.emit(p.targetPos, p.targetNormal, 70, '#ff7700', 2.2, 5.5, 1.6, 0.85);
    context.cameraController.addTrauma(0.65);
    context.audioManager.playCelestialPunch();
  }

  public dispose(): void {
    for (const p of this.activePunches) {
      disposeNode(p.group);
    }
    this.activePunches = [];
  }
}
