import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveSwarm {
  canister: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
  swarmRadius: number;
  dropped: boolean;
}

export class NaniteSwarmWeapon extends Weapon {
  private activeSwarms: ActiveSwarm[] = [];

  constructor() {
    super({
      id: 'nanite_swarm',
      name: 'Nanite Swarm',
      category: 'alien',
      description: 'Self-replicating grey goo nanobot swarm lands and spreads across continents, devouring crust and converting matter into dust.',
      cooldownMs: 2400,
      iconName: 'Sparkles',
      damageRadius: 0.15,
      damageIntensity: 1.2,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 5.0);
    const canisterGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const canisterMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.9 });
    const canister = new THREE.Mesh(canisterGeo, canisterMat);
    canister.position.copy(startPos);
    canister.lookAt(target.point);
    context.scene.add(canister);

    this.activeSwarms.push({
      canister,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 7.0,
      swarmRadius: 0.04,
      dropped: false,
    });

    context.audioManager.playUiClick();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeSwarms.length - 1; i >= 0; i--) {
      const s = this.activeSwarms[i];
      s.timer += delta;

      // Phase 1: Canister drops to surface (~0.8s)
      if (s.timer < 0.8) {
        const t = s.timer / 0.8;
        const start = s.targetPos.clone().addScaledVector(s.targetNormal, 5.0);
        s.canister.position.lerpVectors(start, s.targetPos, t * t);
      } else {
        if (!s.dropped) {
          s.dropped = true;
          s.canister.visible = false;
          context.audioManager.playNaniteDevour();
        }

        // Phase 2: Expanding nanite swarm
        s.swarmRadius += delta * 0.04;

        // Emit glittering metallic nanite particles around the perimeter
        for (let p = 0; p < 4; p++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * s.swarmRadius * 3.5;
          const up = Math.abs(s.targetNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const tanU = new THREE.Vector3().crossVectors(s.targetNormal, up).normalize();
          const tanV = new THREE.Vector3().crossVectors(s.targetNormal, tanU).normalize();

          const particlePos = s.targetPos.clone()
            .addScaledVector(tanU, Math.cos(angle) * r)
            .addScaledVector(tanV, Math.sin(angle) * r)
            .normalize()
            .multiplyScalar(context.planet.config.radius);

          context.particleSystem.emit(particlePos, s.targetNormal, 2, '#88aacc', 0.2, 0.6, 0.3, 0.1);
        }

        // Continuous crust devouring
        if (Math.random() < 0.15) {
          const local = s.targetPos.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: s.targetPos,
            radius: Math.min(0.18, s.swarmRadius),
            intensity: 0.45,
            heat: 0.6,
            timestamp: performance.now(),
          });
        }
      }

      if (s.timer >= s.duration) {
        context.scene.remove(s.canister);
        disposeNode(s.canister);
        this.activeSwarms.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const s of this.activeSwarms) {
      disposeNode(s.canister);
    }
    this.activeSwarms = [];
  }
}
