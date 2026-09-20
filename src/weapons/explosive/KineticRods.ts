import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface TungstenRod {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;
}

interface ActiveBombardment {
  rods: TungstenRod[];
  targetNormal: THREE.Vector3;
}

export class KineticRodsWeapon extends Weapon {
  private activeBombardments: ActiveBombardment[] = [];

  constructor() {
    super({
      id: 'kinetic_rods',
      name: 'Kinetic Rods',
      category: 'explosives',
      description: 'Orbital platform fires solid dense tungsten harpoons at Mach 10, delivering pure kinetic bunker-busting devastation.',
      cooldownMs: 1200,
      iconName: 'ChevronsDown',
      damageRadius: 0.08,
      damageIntensity: 1.1,
    });
  }

  private createRodMesh(): THREE.Mesh {
    const rodGeo = new THREE.CylinderGeometry(0.025, 0.05, 1.2, 8);
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      metalness: 0.95,
      roughness: 0.1,
    });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.x = Math.PI / 2;
    return rod;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const rods: TungstenRod[] = [];
    const count = 3;

    for (let i = 0; i < count; i++) {
      const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tanU = new THREE.Vector3().crossVectors(target.normal, up).normalize();
      const offset = (i - 1) * 0.12;

      const subTarget = target.point.clone().addScaledVector(tanU, offset);
      const startPos = subTarget.clone().addScaledVector(target.normal, 8.0);

      const mesh = this.createRodMesh();
      mesh.position.copy(startPos);
      mesh.lookAt(subTarget);
      context.scene.add(mesh);

      rods.push({
        mesh,
        startPos,
        targetPos: subTarget,
        progress: -(i * 0.22), // Staggered drop
        speed: 1.1, // ~0.9s flight
      });
    }

    this.activeBombardments.push({
      rods,
      targetNormal: target.normal.clone(),
    });

    context.audioManager.playMissileLaunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let bIdx = this.activeBombardments.length - 1; bIdx >= 0; bIdx--) {
      const b = this.activeBombardments[bIdx];

      for (let rIdx = b.rods.length - 1; rIdx >= 0; rIdx--) {
        const rod = b.rods[rIdx];
        rod.progress += rod.speed * delta;

        if (rod.progress < 0) {
          rod.mesh.visible = false;
          continue;
        }
        rod.mesh.visible = true;

        if (rod.progress >= 1.0) {
          this.onRodImpact(rod.targetPos, b.targetNormal, context);
          context.scene.remove(rod.mesh);
          disposeNode(rod.mesh);
          b.rods.splice(rIdx, 1);
          continue;
        }

        rod.mesh.position.lerpVectors(rod.startPos, rod.targetPos, rod.progress);

        // Mach 10 white ionization plasma trail
        context.particleSystem.emit(
          rod.mesh.position,
          b.targetNormal,
          2,
          '#ffffff',
          0.2,
          0.6,
          0.15,
          0.1
        );
      }

      if (b.rods.length === 0) {
        this.activeBombardments.splice(bIdx, 1);
      }
    }
  }

  private onRodImpact(pos: THREE.Vector3, normal: THREE.Vector3, context: WeaponContext): void {
    context.planet.registerImpact({
      u: 0.5,
      v: 0.5,
      position: pos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.9,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(pos, normal, context.planet.config.radius * 0.45, '#ffffff');
    context.particleSystem.emit(pos, normal, 45, '#ffaa33', 1.8, 4.0, 1.2, 0.6);
    context.cameraController.addTrauma(0.4);
    context.audioManager.playTungstenImpact();
  }

  public dispose(): void {
    for (const b of this.activeBombardments) {
      for (const r of b.rods) {
        disposeNode(r.mesh);
      }
    }
    this.activeBombardments = [];
  }
}
