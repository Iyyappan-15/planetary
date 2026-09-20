import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveBuster {
  satelliteGroup: THREE.Group;
  empRing: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  hasFired: boolean;
  duration: number;
}

export class ShieldBusterWeapon extends Weapon {
  private activeBusters: ActiveBuster[] = [];

  constructor() {
    super({
      id: 'shield_buster',
      name: 'Shield Buster',
      category: 'alien',
      description: 'Alien pulse disruptor satellite discharges an electromagnetic overload wave that shatters active planetary defense shields.',
      cooldownMs: 2000,
      iconName: 'ShieldAlert',
      damageRadius: 0.12,
      damageIntensity: 1.5,
    });
  }

  private createBusterSatellite(): { group: THREE.Group; empRing: THREE.Mesh } {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      metalness: 0.95,
      roughness: 0.15,
    });

    const coilMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
    });

    // 1. Central Core
    const coreGeo = new THREE.OctahedronGeometry(0.35);
    const core = new THREE.Mesh(coreGeo, hullMat);
    group.add(core);

    // 2. 3 Rotating EMP Induction Rings
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.TorusGeometry(0.5 + r * 0.2, 0.025, 8, 32);
      const ring = new THREE.Mesh(ringGeo, coilMat);
      ring.rotation.x = r * 0.5;
      ring.rotation.y = r * 0.4;
      group.add(ring);
    }

    // 3. Expanding EMP Shockwave Ring (hidden until fire)
    const empRingGeo = new THREE.RingGeometry(0.1, 0.3, 48);
    const empRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const empRing = new THREE.Mesh(empRingGeo, empRingMat);
    empRing.visible = false;
    group.add(empRing);

    return { group, empRing };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const satPos = target.normal.clone().multiplyScalar(context.planet.config.radius + 2.2);
    const { group, empRing } = this.createBusterSatellite();
    group.position.copy(satPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activeBusters.push({
      satelliteGroup: group,
      empRing,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      hasFired: false,
      duration: 3.5,
    });

    context.audioManager.playEmpBlast();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeBusters.length - 1; i >= 0; i--) {
      const b = this.activeBusters[i];
      b.timer += delta;
      b.satelliteGroup.rotation.z += delta * 3.5;

      // Charge up phase: 0.0 -> 1.0s
      if (b.timer < 1.0) {
        if (Math.random() < 0.4) {
          context.particleSystem.emit(
            b.satelliteGroup.position,
            b.targetNormal,
            2,
            '#00ffff',
            0.2,
            0.8,
            0.2,
            0.1
          );
        }
      } else if (!b.hasFired) {
        b.hasFired = true;
        b.empRing.visible = true;

        // Trigger EMP discharge
        context.audioManager.playEmpBlast();
        context.cameraController.addTrauma(0.5);

        // If shield is active, overload and shatter it immediately!
        if (context.planet.shieldSystem.isActive) {
          context.planet.removeShield();
          context.particleSystem.emit(
            b.targetPos,
            b.targetNormal,
            120,
            '#00ffff',
            3.0,
            7.0,
            2.0,
            0.9
          );
        } else {
          // Normal surface shock impact
          context.planet.registerImpact({
            u: 0.5,
            v: 0.5,
            position: b.targetPos,
            radius: this.config.damageRadius,
            intensity: this.config.damageIntensity,
            heat: 0.8,
            timestamp: performance.now(),
            type: 'laser',
          });
        }

        context.shockwaveSystem.create(b.targetPos, b.targetNormal, context.planet.config.radius * 1.2, '#00ffff');
      } else {
        // Expand EMP ring outwards
        const empScale = 1.0 + (b.timer - 1.0) * 8.0;
        b.empRing.scale.set(empScale, empScale, 1);
        const mat = b.empRing.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1.0 - (b.timer - 1.0) / 1.5);
      }

      if (b.timer >= b.duration) {
        context.scene.remove(b.satelliteGroup);
        disposeNode(b.satelliteGroup);
        this.activeBusters.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const b of this.activeBusters) {
      disposeNode(b.satelliteGroup);
    }
    this.activeBusters = [];
  }
}
