import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveProbe {
  group: THREE.Group;
  beams: THREE.Line[];
  targetPoint: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
}

export class HarvesterProbeWeapon extends Weapon {
  private activeProbes: ActiveProbe[] = [];

  constructor() {
    super({
      id: 'harvester_probe',
      name: 'Harvester Probe',
      category: 'alien',
      description: 'Autonomous alien probe that descends to low altitude and fires tripod energy beams to harvest core resources.',
      cooldownMs: 1400,
      iconName: 'Activity',
      damageRadius: 0.07,
      damageIntensity: 0.8,
    });
  }

  private createProbeMesh(): THREE.Group {
    const group = new THREE.Group();

    // Probe chassis
    const bodyGeo = new THREE.OctahedronGeometry(0.16, 0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x221133,
      emissive: 0x5500aa,
      roughness: 0.3,
      metalness: 0.9,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // 3 Leg pylons
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.9 });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(Math.cos(angle) * 0.18, -0.1, Math.sin(angle) * 0.18);
      leg.rotation.z = Math.cos(angle) * 0.4;
      leg.rotation.x = Math.sin(angle) * 0.4;
      group.add(leg);
    }

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const hoverPos = target.normal.clone().multiplyScalar(context.planet.config.radius + 1.1);
    const group = this.createProbeMesh();
    group.position.copy(hoverPos);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.normal);
    context.scene.add(group);

    // 3 Harvester tripod beams
    const beams: THREE.Line[] = [];
    const legRadius = 0.35;
    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tanU = new THREE.Vector3().crossVectors(target.normal, up).normalize();
    const tanV = new THREE.Vector3().crossVectors(target.normal, tanU).normalize();

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const groundContact = target.point.clone()
        .addScaledVector(tanU, Math.cos(angle) * legRadius)
        .addScaledVector(tanV, Math.sin(angle) * legRadius)
        .normalize()
        .multiplyScalar(context.planet.config.radius);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([hoverPos, groundContact]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xaa00ff,
        transparent: true,
        opacity: 0.85,
      });
      const beam = new THREE.Line(lineGeo, lineMat);
      context.scene.add(beam);
      beams.push(beam);
    }

    this.activeProbes.push({
      group,
      beams,
      targetPoint: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 10.0, // Harvests for 10 seconds
    });

    context.audioManager.playUiClick();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeProbes.length - 1; i >= 0; i--) {
      const p = this.activeProbes[i];
      p.timer += delta;
      p.group.rotation.y += delta * 2.5;

      // Extract energy particles ascending toward the probe
      context.particleSystem.emit(
        p.targetPoint,
        p.targetNormal,
        3,
        '#aa00ff',
        0.3,
        1.5,
        0.3,
        0.1
      );

      // Periodic damage ticks
      if (Math.random() < 0.08) {
        const local = p.targetPoint.clone();
        context.planet.surfaceMesh.worldToLocal(local);
        const uv = vector3ToUV(local);
        const { lat, lon } = vector3ToLatLon(local);

        context.planet.registerImpact({
          u: uv.u,
          v: uv.v,
          lat,
          lon,
          position: p.targetPoint,
          radius: 0.035,
          intensity: 0.5,
          heat: 0.8,
          timestamp: performance.now(),
        });
      }

      // Smooth ascent and warp out in the final 0.8s
      if (p.timer >= p.duration - 0.8) {
        p.group.position.addScaledVector(p.targetNormal, delta * 5.0);
        for (const b of p.beams) {
          (b.material as THREE.LineBasicMaterial).opacity = Math.max(0, (p.duration - p.timer) / 0.8);
        }
      }

      if (p.timer >= p.duration) {
        context.particleSystem.emit(p.group.position, p.targetNormal, 20, '#cc44ff', 1.0, 2.5, 0.6, 0.4);
        context.scene.remove(p.group);
        disposeNode(p.group);
        for (const b of p.beams) {
          context.scene.remove(b);
          disposeNode(b);
        }
        this.activeProbes.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const p of this.activeProbes) {
      disposeNode(p.group);
      for (const b of p.beams) {
        disposeNode(b);
      }
    }
    this.activeProbes = [];
  }
}
