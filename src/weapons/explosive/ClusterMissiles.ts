import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface SubMissile {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;
}

interface ActiveCluster {
  subMissiles: SubMissile[];
  targetNormal: THREE.Vector3;
}

export class ClusterMissilesWeapon extends Weapon {
  private activeClusters: ActiveCluster[] = [];
  private missileGeo: THREE.ConeGeometry;
  private missileMat: THREE.MeshStandardMaterial;

  constructor() {
    super({
      id: 'cluster_missiles',
      name: 'Cluster Missiles',
      category: 'explosives',
      description: 'Carrier rocket that splits into 5 independent homing missiles, blanketing a region in rapid explosions.',
      cooldownMs: 900,
      iconName: 'Boxes',
      keyShortcut: '2',
      damageRadius: 0.12,
      damageIntensity: 0.7,
    });

    this.missileGeo = new THREE.ConeGeometry(0.035, 0.22, 8);
    this.missileMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x441100,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const clusterOrigin = target.point.clone().addScaledVector(target.normal, 7.5);
    const subMissiles: SubMissile[] = [];

    // Create 5 spread-out impact targets around the clicked area
    const subCount = 5;
    const spreadRadius = 0.55;

    // Up and right vectors tangent to the surface
    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tangentU = new THREE.Vector3().crossVectors(target.normal, up).normalize();
    const tangentV = new THREE.Vector3().crossVectors(target.normal, tangentU).normalize();

    for (let i = 0; i < subCount; i++) {
      const angle = (i / subCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = (i === 0 ? 0.05 : spreadRadius * (0.6 + Math.random() * 0.4));
      
      const subTargetPoint = target.point.clone()
        .addScaledVector(tangentU, Math.cos(angle) * dist)
        .addScaledVector(tangentV, Math.sin(angle) * dist)
        .normalize()
        .multiplyScalar(context.planet.config.radius);

      const subStart = clusterOrigin.clone()
        .addScaledVector(tangentU, Math.cos(angle) * 1.5)
        .addScaledVector(tangentV, Math.sin(angle) * 1.5);

      const mesh = new THREE.Mesh(this.missileGeo, this.missileMat.clone());
      mesh.position.copy(subStart);
      mesh.lookAt(subTargetPoint);
      context.scene.add(mesh);

      subMissiles.push({
        mesh,
        startPos: subStart,
        targetPos: subTargetPoint,
        progress: 0,
        speed: 0.65 + Math.random() * 0.2, // ~1.5s flight time with natural stagger
      });
    }

    this.activeClusters.push({
      subMissiles,
      targetNormal: target.normal.clone(),
    });

    context.audioManager.playMissileLaunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let cIdx = this.activeClusters.length - 1; cIdx >= 0; cIdx--) {
      const cluster = this.activeClusters[cIdx];

      for (let mIdx = cluster.subMissiles.length - 1; mIdx >= 0; mIdx--) {
        const sm = cluster.subMissiles[mIdx];
        sm.progress += sm.speed * delta;

        if (sm.progress >= 1.0) {
          this.onSubImpact(sm, cluster.targetNormal, context);
          context.scene.remove(sm.mesh);
          disposeNode(sm.mesh);
          cluster.subMissiles.splice(mIdx, 1);
          continue;
        }

        // Interpolate position
        sm.mesh.position.lerpVectors(sm.startPos, sm.targetPos, sm.progress);
        sm.mesh.lookAt(sm.targetPos);

        // Exhaust sparks
        context.particleSystem.emit(
          sm.mesh.position,
          cluster.targetNormal,
          2,
          '#ffaa00',
          0.12,
          0.5,
          0.15,
          0.1
        );
      }

      if (cluster.subMissiles.length === 0) {
        this.activeClusters.splice(cIdx, 1);
      }
    }
  }

  private onSubImpact(sub: SubMissile, normal: THREE.Vector3, context: WeaponContext): void {
    const local = sub.targetPos.clone();
    context.planet.surfaceMesh.worldToLocal(local);
    const uv = vector3ToUV(local);
    const { lat, lon } = vector3ToLatLon(local);

    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: sub.targetPos,
      radius: 0.042,
      intensity: 0.65,
      heat: 0.8,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(sub.targetPos, normal, context.planet.config.radius * 0.28, '#ff9900');
    context.particleSystem.emit(sub.targetPos, normal, 28, '#ff7700', 0.9, 2.5, 0.8, 0.5);
    context.cameraController.addTrauma(0.16);
    context.audioManager.playMeteorImpact();
  }

  public dispose(): void {
    for (const c of this.activeClusters) {
      for (const sm of c.subMissiles) {
        disposeNode(sm.mesh);
      }
    }
    this.activeClusters = [];
    this.missileGeo.dispose();
    this.missileMat.dispose();
  }
}
