import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface WormSegment {
  mesh: THREE.Mesh;
  offset: number; // Delay along spline
}

interface ActiveWorm {
  segments: WormSegment[];
  entryPoint: THREE.Vector3;
  exitPoint: THREE.Vector3;
  entryNormal: THREE.Vector3;
  exitNormal: THREE.Vector3;
  progress: number;
  curve: THREE.CatmullRomCurve3;
  hasBurrowedEntry: boolean;
  hasBurrowedExit: boolean;
}

export class SpaceWormWeapon extends Weapon {
  private activeWorms: ActiveWorm[] = [];

  constructor() {
    super({
      id: 'space_worm',
      name: 'Space Worm',
      category: 'monsters',
      description: 'Iconic Solar Smash monster! Colossal segmented serpentine beast that dives into the planet, burrows through the core, and erupts out the other side!',
      cooldownMs: 2500,
      iconName: 'Bug',
      damageRadius: 0.16,
      damageIntensity: 1.8,
    });
  }

  private createWormMeshes(): WormSegment[] {
    const segments: WormSegment[] = [];
    const segmentCount = 14;

    for (let i = 0; i < segmentCount; i++) {
      const isHead = i === 0;
      const radius = isHead ? 0.14 : Math.max(0.04, 0.13 * (1.0 - (i / segmentCount) * 0.7));
      const geo = isHead ? new THREE.ConeGeometry(radius, 0.26, 8) : new THREE.SphereGeometry(radius, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: isHead ? 0xcc2200 : (i % 2 === 0 ? 0x881100 : 0x440800),
        emissive: isHead ? 0xff4400 : 0x220500,
        roughness: 0.4,
        metalness: 0.7,
      });

      const mesh = new THREE.Mesh(geo, mat);
      segments.push({
        mesh,
        offset: i * 0.035, // Distance delay behind head
      });
    }

    return segments;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const entryPoint = target.point.clone();
    const entryNormal = target.normal.clone();
    // Exit point on the exact opposite hemisphere with slight natural tilt
    const exitNormal = entryNormal.clone().negate();
    exitNormal.x += (Math.random() - 0.5) * 0.2;
    exitNormal.normalize();
    const exitPoint = exitNormal.clone().multiplyScalar(context.planet.config.radius);

    // Deep space spawn above entry point
    const spawnPoint = entryPoint.clone().addScaledVector(entryNormal, 6.0);
    // Planet core waypoint
    const corePoint = new THREE.Vector3(0, 0, 0);
    // Deep space leap beyond exit point
    const leapPoint = exitPoint.clone().addScaledVector(exitNormal, 6.0);

    // 5-point smooth spline path through the planet
    const curve = new THREE.CatmullRomCurve3([
      spawnPoint,
      entryPoint.clone().addScaledVector(entryNormal, 0.5),
      corePoint,
      exitPoint.clone().addScaledVector(exitNormal, 0.5),
      leapPoint,
    ]);

    const segments = this.createWormMeshes();
    for (const seg of segments) {
      context.scene.add(seg.mesh);
    }

    this.activeWorms.push({
      segments,
      entryPoint,
      exitPoint,
      entryNormal,
      exitNormal,
      progress: 0,
      curve,
      hasBurrowedEntry: false,
      hasBurrowedExit: false,
    });

    context.audioManager.playSpaceWormRoar();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let wIdx = this.activeWorms.length - 1; wIdx >= 0; wIdx--) {
      const worm = this.activeWorms[wIdx];
      worm.progress += delta * 0.45; // ~2.2s total traversal

      for (let sIdx = 0; sIdx < worm.segments.length; sIdx++) {
        const seg = worm.segments[sIdx];
        const segT = Math.max(0, Math.min(1.0, worm.progress - seg.offset));

        const pt = worm.curve.getPointAt(segT);
        seg.mesh.position.copy(pt);

        const tangent = worm.curve.getTangentAt(segT);
        seg.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

        // Subterranean body writhing
        const writhe = Math.sin(worm.progress * 15.0 + sIdx * 0.6) * 0.04;
        seg.mesh.position.x += writhe;

        // Eject magma sparks behind head
        if (sIdx === 0 && Math.random() < 0.4) {
          context.particleSystem.emit(pt, tangent, 2, '#ff3300', 0.2, 0.8, 0.2, 0.1);
        }
      }

      // 1. Entry breach impact
      if (worm.progress >= 0.25 && !worm.hasBurrowedEntry) {
        worm.hasBurrowedEntry = true;
        this.onBreach(worm.entryPoint, worm.entryNormal, context);
      }

      // 2. Exit breach impact on opposite side
      if (worm.progress >= 0.75 && !worm.hasBurrowedExit) {
        worm.hasBurrowedExit = true;
        this.onBreach(worm.exitPoint, worm.exitNormal, context);
      }

      // Finished travel into deep space
      if (worm.progress >= 1.4) {
        for (const seg of worm.segments) {
          context.scene.remove(seg.mesh);
          disposeNode(seg.mesh);
        }
        this.activeWorms.splice(wIdx, 1);
      }
    }
  }

  private onBreach(point: THREE.Vector3, normal: THREE.Vector3, context: WeaponContext): void {
    const local = point.clone();
    context.planet.surfaceMesh.worldToLocal(local);
    const uv = vector3ToUV(local);
    const { lat, lon } = vector3ToLatLon(local);

    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.95,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(point, normal, context.planet.config.radius * 0.6, '#ff3300');
    context.particleSystem.emit(point, normal, 65, '#ff2200', 1.8, 4.5, 1.4, 0.8);
    context.cameraController.addTrauma(0.4);
    context.audioManager.playSpaceWormRoar();
  }

  public dispose(): void {
    for (const w of this.activeWorms) {
      for (const s of w.segments) {
        disposeNode(s.mesh);
      }
    }
    this.activeWorms = [];
  }
}
