import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveBlade {
  mesh: THREE.Mesh;
  centerPos: THREE.Vector3;
  normal: THREE.Vector3;
  tangent: THREE.Vector3;
  progress: number;
  length: number;
}

export class LaserBladeWeapon extends Weapon {
  private activeBlades: ActiveBlade[] = [];

  constructor() {
    super({
      id: 'laser_blade',
      name: 'Laser Blade',
      category: 'lasers',
      description: 'Massive orbital energy blade that sweeps down and slices clean molten chasms through planetary crust.',
      cooldownMs: 850,
      iconName: 'Sword',
      keyShortcut: '9',
      damageRadius: 0.11,
      damageIntensity: 1.15,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // Determine slice axis tangent to surface
    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const sliceDir = new THREE.Vector3().crossVectors(target.normal, up).normalize();

    // Create a 2.5-unit long luminous energy blade
    const bladeLen = 2.4;
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.6, bladeLen);
    const bladeMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(bladeGeo, bladeMat);

    // Initial position hovering above surface
    const startPos = target.point.clone().addScaledVector(target.normal, 1.8);
    mesh.position.copy(startPos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sliceDir);
    context.scene.add(mesh);

    this.activeBlades.push({
      mesh,
      centerPos: target.point.clone(),
      normal: target.normal.clone(),
      tangent: sliceDir,
      progress: 0,
      length: bladeLen,
    });

    context.audioManager.playLaserBlade();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeBlades.length - 1; i >= 0; i--) {
      const blade = this.activeBlades[i];
      blade.progress += delta * 0.7; // Slice duration ~1.4s

      // Move down into the planet and slice across
      const depth = Math.sin(blade.progress * Math.PI) * 0.4;
      const currentPos = blade.centerPos.clone().addScaledVector(blade.normal, (1.0 - blade.progress) * 1.5 - depth);
      blade.mesh.position.copy(currentPos);
      blade.mesh.rotation.y += delta * 8.0;

      // When blade plunges into crust (middle of slice)
      if (blade.progress >= 0.45 && blade.progress <= 0.65) {
        // Cut consecutive gouges along blade length
        const steps = 6;
        for (let s = -steps / 2; s <= steps / 2; s++) {
          const cutPos = blade.centerPos.clone()
            .addScaledVector(blade.tangent, (s / steps) * (blade.length * 0.5))
            .normalize()
            .multiplyScalar(context.planet.config.radius);

          const local = cutPos.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: cutPos,
            radius: 0.035,
            intensity: 0.75,
            heat: 0.95,
            timestamp: performance.now(),
            type: 'laser',
          });
        }

        context.shockwaveSystem.create(blade.centerPos, blade.normal, context.planet.config.radius * 0.4, '#ff0055');
        context.particleSystem.emit(blade.centerPos, blade.normal, 40, '#ff1166', 1.2, 3.0, 0.8, 0.5);
        context.cameraController.addTrauma(0.25);
      }

      if (blade.progress >= 1.0) {
        context.scene.remove(blade.mesh);
        disposeNode(blade.mesh);
        this.activeBlades.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const b of this.activeBlades) {
      disposeNode(b.mesh);
    }
    this.activeBlades = [];
  }
}
