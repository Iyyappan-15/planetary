import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface LiftedChunk {
  mesh: THREE.Mesh;
  localPos: THREE.Vector3;
  groundPos: THREE.Vector3;
  orbitPos: THREE.Vector3;
}

interface ActiveDisruptor {
  chunks: LiftedChunk[];
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
  hasCrashed: boolean;
}

export class AntiGravityDisruptorWeapon extends Weapon {
  private activeDisruptors: ActiveDisruptor[] = [];

  constructor() {
    super({
      id: 'antigravity_disruptor',
      name: 'Anti-Gravity Disruptor',
      category: 'alien',
      description: 'Inverts local gravity to lift colossal chunks of crust into orbit, then crashes them back down in a kinetic cataclysm.',
      cooldownMs: 2500,
      iconName: 'MoveVertical',
      damageRadius: 0.18,
      damageIntensity: 1.4,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x332211,
      emissive: 0xff3300,
      emissiveIntensity: 0.5,
      roughness: 0.8,
    });

    const chunks: LiftedChunk[] = [];
    const count = 7;
    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tanU = new THREE.Vector3().crossVectors(target.normal, up).normalize();
    const tanV = new THREE.Vector3().crossVectors(target.normal, tanU).normalize();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.2 + (i % 3) * 0.15;
      const groundPos = target.point.clone()
        .addScaledVector(tanU, Math.cos(angle) * radius)
        .addScaledVector(tanV, Math.sin(angle) * radius)
        .normalize()
        .multiplyScalar(context.planet.config.radius);

      const orbitPos = groundPos.clone().addScaledVector(target.normal, 2.5 + Math.random() * 0.8);

      const geo = new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.12, 1);
      const mesh = new THREE.Mesh(geo, chunkMat.clone());
      mesh.position.copy(groundPos);
      context.scene.add(mesh);

      chunks.push({
        mesh,
        localPos: groundPos.clone(),
        groundPos,
        orbitPos,
      });
    }

    this.activeDisruptors.push({
      chunks,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 5.5,
      hasCrashed: false,
    });

    context.audioManager.playGravityInvert();
    context.shockwaveSystem.create(target.point, target.normal, context.planet.config.radius * 0.7, '#cc44ff');
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeDisruptors.length - 1; i >= 0; i--) {
      const d = this.activeDisruptors[i];
      d.timer += delta;

      if (d.timer < 2.5) {
        // Phase 1: Inverted gravity lift into orbit
        const t = d.timer / 2.5;
        const ease = Math.sin((t * Math.PI) / 2);
        for (const c of d.chunks) {
          c.mesh.position.lerpVectors(c.groundPos, c.orbitPos, ease);
          c.mesh.rotation.x += delta * 2.0;
          c.mesh.rotation.y += delta * 3.0;

          // Anti-gravity purple energy particles
          if (Math.random() < 0.2) {
            context.particleSystem.emit(c.mesh.position, d.targetNormal, 1, '#bb33ff', 0.2, 0.6, 0.2, 0.1);
          }
        }
      } else if (d.timer < 3.5) {
        // Phase 2: Floating in orbit
        for (const c of d.chunks) {
          c.mesh.rotation.x += delta * 1.5;
        }
      } else if (!d.hasCrashed) {
        // Phase 3: Sudden violent gravity restoration & kinetic slam
        const crashT = Math.min(1.0, (d.timer - 3.5) / 0.7);
        const easeCrash = crashT * crashT * crashT;

        for (const c of d.chunks) {
          c.mesh.position.lerpVectors(c.orbitPos, c.groundPos, easeCrash);
        }

        if (crashT >= 1.0) {
          d.hasCrashed = true;

          // Massive impact & devastation
          context.planet.registerImpact({
            u: 0.5,
            v: 0.5,
            position: d.targetPos,
            radius: this.config.damageRadius,
            intensity: this.config.damageIntensity,
            heat: 0.9,
            timestamp: performance.now(),
          });

          context.shockwaveSystem.create(d.targetPos, d.targetNormal, context.planet.config.radius * 1.0, '#ff4400');
          context.particleSystem.emit(d.targetPos, d.targetNormal, 80, '#ff6600', 2.2, 5.5, 1.6, 0.85);
          context.cameraController.addTrauma(0.7);
          context.audioManager.playMeteorImpact();

          for (const c of d.chunks) {
            context.scene.remove(c.mesh);
            disposeNode(c.mesh);
          }
        }
      }

      if (d.timer >= d.duration) {
        this.activeDisruptors.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const d of this.activeDisruptors) {
      for (const c of d.chunks) {
        disposeNode(c.mesh);
      }
    }
    this.activeDisruptors = [];
  }
}
