import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveTectonic {
  mesh: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
  quakeTimer: number;
  hasPlunged: boolean;
}

export class TectonicDisruptorWeapon extends Weapon {
  private activeDisruptors: ActiveTectonic[] = [];

  constructor() {
    super({
      id: 'tectonic_disruptor',
      name: 'Tectonic Disruptor',
      category: 'explosives',
      description: 'Seismic warhead burrows into fault lines, triggering cascading mega-earthquakes and fracture lines across the crust.',
      cooldownMs: 2000,
      iconName: 'Activity',
      damageRadius: 0.16,
      damageIntensity: 1.3,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 5.0);
    const geo = new THREE.ConeGeometry(0.18, 0.8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0x880000, roughness: 0.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.normal);
    context.scene.add(mesh);

    this.activeDisruptors.push({
      mesh,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 4.8,
      quakeTimer: 0.3,
      hasPlunged: false,
    });

    context.audioManager.playMissileLaunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeDisruptors.length - 1; i >= 0; i--) {
      const t = this.activeDisruptors[i];
      t.timer += delta;

      if (!t.hasPlunged) {
        // Fall into ground
        const fallT = Math.min(1.0, t.timer / 0.9);
        const start = t.targetPos.clone().addScaledVector(t.targetNormal, 5.0);
        t.mesh.position.lerpVectors(start, t.targetPos, fallT * fallT);

        if (fallT >= 1.0) {
          t.hasPlunged = true;
          t.mesh.visible = false;
          context.audioManager.playTectonicRumble();
          context.cameraController.addTrauma(0.6);
        }
      } else {
        // Periodic cascading tectonic quakes radiating outward
        t.quakeTimer -= delta;
        if (t.quakeTimer <= 0) {
          t.quakeTimer = 0.45;

          const distance = (t.timer - 0.9) * 0.18;
          const angle = Math.random() * Math.PI * 2;
          const up = Math.abs(t.targetNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const tanU = new THREE.Vector3().crossVectors(t.targetNormal, up).normalize();
          const tanV = new THREE.Vector3().crossVectors(t.targetNormal, tanU).normalize();

          const quakePos = t.targetPos.clone()
            .addScaledVector(tanU, Math.cos(angle) * distance)
            .addScaledVector(tanV, Math.sin(angle) * distance)
            .normalize()
            .multiplyScalar(context.planet.config.radius);

          const local = quakePos.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: quakePos,
            radius: 0.05,
            intensity: 0.65,
            heat: 0.85,
            timestamp: performance.now(),
          });

          context.shockwaveSystem.create(quakePos, t.targetNormal, context.planet.config.radius * 0.4, '#ff6600');
          context.particleSystem.emit(quakePos, t.targetNormal, 20, '#ff4400', 1.0, 3.0, 0.8, 0.4);
          context.cameraController.addTrauma(0.15);
        }
      }

      if (t.timer >= t.duration) {
        context.scene.remove(t.mesh);
        disposeNode(t.mesh);
        this.activeDisruptors.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const t of this.activeDisruptors) {
      disposeNode(t.mesh);
    }
    this.activeDisruptors = [];
  }
}
