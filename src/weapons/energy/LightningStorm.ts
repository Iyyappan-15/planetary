import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface BoltArc {
  line: THREE.Line;
  timer: number;
}

export class LightningStormWeapon extends Weapon {
  private activeArcs: BoltArc[] = [];

  constructor() {
    super({
      id: 'lightning_storm',
      name: 'Lightning Storm',
      category: 'lasers',
      description: 'Ionospheric super-discharges that strike multiple violent electrical arcs across the planetary atmosphere.',
      cooldownMs: 700,
      iconName: 'CloudLightning',
      damageRadius: 0.09,
      damageIntensity: 0.75,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const stormCloudPos = target.point.clone().addScaledVector(target.normal, 2.5);
    const strikeCount = 4;

    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tangentU = new THREE.Vector3().crossVectors(target.normal, up).normalize();
    const tangentV = new THREE.Vector3().crossVectors(target.normal, tangentU).normalize();

    for (let s = 0; s < strikeCount; s++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.45;
      const strikePoint = target.point.clone()
        .addScaledVector(tangentU, Math.cos(angle) * dist)
        .addScaledVector(tangentV, Math.sin(angle) * dist)
        .normalize()
        .multiplyScalar(context.planet.config.radius);

      // Generate jagged multi-segment lightning line
      const points: THREE.Vector3[] = [];
      const segments = 10;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = stormCloudPos.clone().lerp(strikePoint, t);
        if (i > 0 && i < segments) {
          pt.x += (Math.random() - 0.5) * 0.18;
          pt.y += (Math.random() - 0.5) * 0.18;
          pt.z += (Math.random() - 0.5) * 0.18;
        }
        points.push(pt);
      }

      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x88ccff,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      context.scene.add(line);

      this.activeArcs.push({ line, timer: 0.18 + Math.random() * 0.1 });

      // Apply damage at ground contact point
      const local = strikePoint.clone();
      context.planet.surfaceMesh.worldToLocal(local);
      const uv = vector3ToUV(local);
      const { lat, lon } = vector3ToLatLon(local);

      context.planet.registerImpact({
        u: uv.u,
        v: uv.v,
        lat,
        lon,
        position: strikePoint,
        radius: 0.035,
        intensity: 0.65,
        heat: 0.85,
        timestamp: performance.now(),
      });

      context.particleSystem.emit(strikePoint, target.normal, 15, '#aaddff', 0.8, 1.8, 0.4, 0.2);
    }

    context.shockwaveSystem.create(target.point, target.normal, context.planet.config.radius * 0.35, '#88ddff');
    context.cameraController.addTrauma(0.2);
    context.audioManager.playLightning();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeArcs.length - 1; i >= 0; i--) {
      const arc = this.activeArcs[i];
      arc.timer -= delta;
      if (arc.timer <= 0) {
        context.scene.remove(arc.line);
        disposeNode(arc.line);
        this.activeArcs.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const a of this.activeArcs) {
      disposeNode(a.line);
    }
    this.activeArcs = [];
  }
}
