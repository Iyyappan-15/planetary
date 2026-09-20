import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface Tentacle {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  angle: number;
}

interface ActivePortal {
  portalMesh: THREE.Mesh;
  tentacles: Tentacle[];
  targetPoint: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
}

export class AbyssalDevourerWeapon extends Weapon {
  private activePortals: ActivePortal[] = [];

  constructor() {
    super({
      id: 'abyssal_devourer',
      name: 'Abyssal Devourer',
      category: 'monsters',
      description: 'Dark void portal opens on the surface, releasing colossal writhing tentacles that smash the planetary crust.',
      cooldownMs: 2200,
      iconName: 'Octagon',
      damageRadius: 0.15,
      damageIntensity: 1.3,
    });
  }

  private createPortalMesh(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(0.45, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x220033,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    return new THREE.Mesh(geo, mat);
  }

  private createTentacles(center: THREE.Vector3, normal: THREE.Vector3): Tentacle[] {
    const tentacles: Tentacle[] = [];
    const count = 4;

    const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tanU = new THREE.Vector3().crossVectors(normal, up).normalize();
    const tanV = new THREE.Vector3().crossVectors(normal, tanU).normalize();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const basePos = center.clone()
        .addScaledVector(tanU, Math.cos(angle) * 0.15)
        .addScaledVector(tanV, Math.sin(angle) * 0.15);

      // Curved tapered tentacle
      const tentacleGeo = new THREE.CylinderGeometry(0.02, 0.08, 0.9, 8);
      const tentacleMat = new THREE.MeshStandardMaterial({
        color: 0x330044,
        emissive: 0x660099,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(tentacleGeo, tentacleMat);
      mesh.position.copy(basePos);
      tentacles.push({ mesh, basePos, angle });
    }

    return tentacles;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const portalMesh = this.createPortalMesh();
    portalMesh.position.copy(target.point).addScaledVector(target.normal, 0.02);
    portalMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), target.normal);
    context.scene.add(portalMesh);

    const tentacles = this.createTentacles(target.point, target.normal);
    for (const t of tentacles) {
      context.scene.add(t.mesh);
    }

    this.activePortals.push({
      portalMesh,
      tentacles,
      targetPoint: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 3.2,
    });

    context.audioManager.playTentacleSlam();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let pIdx = this.activePortals.length - 1; pIdx >= 0; pIdx--) {
      const portal = this.activePortals[pIdx];
      portal.timer += delta;

      // Writhing tentacle animation
      for (const t of portal.tentacles) {
        const slamCycle = Math.sin(portal.timer * 6.0 + t.angle);
        t.mesh.rotation.x = Math.sin(portal.timer * 4.0 + t.angle) * 0.7;
        t.mesh.rotation.z = Math.cos(portal.timer * 4.0 + t.angle) * 0.7;
        t.mesh.position.copy(t.basePos).addScaledVector(portal.targetNormal, 0.4 + slamCycle * 0.2);

        // Ground smash impact on downward stroke
        if (slamCycle < -0.85 && Math.random() < 0.2) {
          const local = t.basePos.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: t.basePos,
            radius: 0.04,
            intensity: 0.55,
            heat: 0.75,
            timestamp: performance.now(),
          });

          context.particleSystem.emit(t.basePos, portal.targetNormal, 10, '#8800cc', 0.6, 1.8, 0.4, 0.2);
          context.cameraController.addTrauma(0.12);
        }
      }

      if (portal.timer >= portal.duration) {
        context.scene.remove(portal.portalMesh);
        disposeNode(portal.portalMesh);
        for (const t of portal.tentacles) {
          context.scene.remove(t.mesh);
          disposeNode(t.mesh);
        }
        this.activePortals.splice(pIdx, 1);
      }
    }
  }

  public dispose(): void {
    for (const p of this.activePortals) {
      disposeNode(p.portalMesh);
      for (const t of p.tentacles) {
        disposeNode(t.mesh);
      }
    }
    this.activePortals = [];
  }
}
