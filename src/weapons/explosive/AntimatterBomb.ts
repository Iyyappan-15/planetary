import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveBomb {
  group: THREE.Group;
  ring1: THREE.Mesh;
  ring2: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
  speed: number;
  phase: 'descending' | 'arming';
  armTimer: number;
}

export class AntimatterBombWeapon extends Weapon {
  private activeBombs: ActiveBomb[] = [];

  constructor() {
    super({
      id: 'antimatter_bomb',
      name: 'Antimatter Bomb',
      category: 'explosives',
      description: 'High-tech device with spinning gyroscopic rings that triggers a dark-matter implosion upon impact.',
      cooldownMs: 1400,
      iconName: 'Radioactive',
      keyShortcut: '3',
      damageRadius: 0.14,
      damageIntensity: 1.3,
    });
  }

  private createBombMesh(): { group: THREE.Group; ring1: THREE.Mesh; ring2: THREE.Mesh } {
    const group = new THREE.Group();

    // Central core: glowing dark-purple sphere
    const coreGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x9900ee,
      emissive: 0xcc00ff,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Inner rotating gimbal ring
    const ring1Geo = new THREE.TorusGeometry(0.14, 0.018, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x334466,
      metalness: 0.9,
      roughness: 0.2,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ringMat);
    group.add(ring1);

    // Outer rotating gimbal ring
    const ring2Geo = new THREE.TorusGeometry(0.19, 0.018, 8, 24);
    const ring2 = new THREE.Mesh(ring2Geo, ringMat);
    group.add(ring2);

    return { group, ring1, ring2 };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 6.0);
    const { group, ring1, ring2 } = this.createBombMesh();
    group.position.copy(startPos);
    context.scene.add(group);

    this.activeBombs.push({
      group,
      ring1,
      ring2,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
      speed: 0.65, // ~1.5s descent with spinning gyroscopic rings
      phase: 'descending',
      armTimer: 0,
    });

    context.audioManager.playUiClick();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeBombs.length - 1; i >= 0; i--) {
      const bomb = this.activeBombs[i];

      // Spin gyroscopic rings continuously
      bomb.ring1.rotation.x += delta * 6.0;
      bomb.ring1.rotation.y += delta * 4.0;
      bomb.ring2.rotation.y -= delta * 5.0;
      bomb.ring2.rotation.z += delta * 7.0;

      if (bomb.phase === 'descending') {
        bomb.progress += bomb.speed * delta;
        bomb.group.position.lerpVectors(bomb.startPos, bomb.targetPos, bomb.progress);

        // Violet ionization field
        context.particleSystem.emit(
          bomb.group.position,
          bomb.targetNormal,
          2,
          '#cc00ff',
          0.15,
          0.4,
          0.2,
          0.1
        );

        if (bomb.progress >= 1.0) {
          bomb.phase = 'arming';
          bomb.armTimer = 1.2; // Dramatic 1.2s pulsating countdown before implosion
        }
      } else if (bomb.phase === 'arming') {
        bomb.armTimer -= delta;

        // Pulsing scale
        const pulse = 1.0 + Math.sin(performance.now() * 0.04) * 0.3;
        bomb.group.scale.set(pulse, pulse, pulse);

        if (bomb.armTimer <= 0) {
          this.onDetonate(bomb, context);
          context.scene.remove(bomb.group);
          disposeNode(bomb.group);
          this.activeBombs.splice(i, 1);
        }
      }
    }
  }

  private onDetonate(bomb: ActiveBomb, context: WeaponContext): void {
    context.planet.registerImpact({
      u: bomb.targetUV.u,
      v: bomb.targetUV.v,
      lat: bomb.targetLat,
      lon: bomb.targetLon,
      position: bomb.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // Dark-violet antimatter shockwave
    context.shockwaveSystem.create(bomb.targetPos, bomb.targetNormal, context.planet.config.radius * 0.6, '#cc22ff');
    context.particleSystem.emit(bomb.targetPos, bomb.targetNormal, 70, '#aa00ee', 1.8, 4.0, 1.4, 0.7);

    context.cameraController.addTrauma(0.4);
    context.audioManager.playNuclearDetonation();
  }

  public dispose(): void {
    for (const b of this.activeBombs) {
      disposeNode(b.group);
    }
    this.activeBombs = [];
  }
}
