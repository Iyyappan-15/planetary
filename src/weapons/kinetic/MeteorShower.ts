import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ShowerMeteor {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  progress: number;
  speed: number;
}

export class MeteorShowerWeapon extends Weapon {
  private activeMeteors: ShowerMeteor[] = [];
  private rockGeo: THREE.DodecahedronGeometry;
  private rockMat: THREE.MeshStandardMaterial;

  constructor() {
    super({
      id: 'meteor_shower',
      name: 'Meteor Shower',
      category: 'celestial',
      description: 'Bombards the planet with a barrage of hyper-velocity flaming space rocks entering from deep orbit.',
      cooldownMs: 400,
      iconName: 'Flame',
      damageRadius: 0.05,
      damageIntensity: 0.8,
    });

    this.rockGeo = new THREE.DodecahedronGeometry(0.12, 1);
    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x332211,
      roughness: 0.9,
      metalness: 0.1,
      emissive: 0xff4400,
      emissiveIntensity: 0.9,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const meteorCount = 3;
    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tangentU = new THREE.Vector3().crossVectors(target.normal, up).normalize();
    const tangentV = new THREE.Vector3().crossVectors(target.normal, tangentU).normalize();

    for (let i = 0; i < meteorCount; i++) {
      const angle = (i / meteorCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = Math.random() * 0.35;
      const subTarget = target.point.clone()
        .addScaledVector(tangentU, Math.cos(angle) * dist)
        .addScaledVector(tangentV, Math.sin(angle) * dist)
        .normalize()
        .multiplyScalar(context.planet.config.radius);

      const startPos = subTarget.clone().addScaledVector(target.normal, 7.0 + Math.random() * 2.0);
      startPos.x += (Math.random() - 0.5) * 2.0;
      startPos.y += (Math.random() - 0.5) * 2.0;

      const mesh = new THREE.Mesh(this.rockGeo, this.rockMat.clone());
      mesh.position.copy(startPos);
      context.scene.add(mesh);

      this.activeMeteors.push({
        mesh,
        startPos,
        targetPos: subTarget,
        targetNormal: target.normal.clone(),
        progress: -(i * 0.12), // Staggered launches
        speed: 3.8,
      });
    }

    context.audioManager.playMeteorImpact();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
      const m = this.activeMeteors[i];
      m.progress += m.speed * delta;

      if (m.progress < 0) {
        m.mesh.visible = false;
        continue;
      }
      m.mesh.visible = true;

      if (m.progress >= 1.0) {
        this.onImpact(m, context);
        context.scene.remove(m.mesh);
        disposeNode(m.mesh);
        this.activeMeteors.splice(i, 1);
        continue;
      }

      m.mesh.position.lerpVectors(m.startPos, m.targetPos, m.progress);
      m.mesh.rotation.x += delta * 6.0;
      m.mesh.rotation.y += delta * 8.0;

      // Fiery ionization tail
      context.particleSystem.emit(
        m.mesh.position,
        m.targetNormal,
        2,
        '#ffaa00',
        0.18,
        0.7,
        0.25,
        0.15
      );
    }
  }

  private onImpact(m: ShowerMeteor, context: WeaponContext): void {
    const local = m.targetPos.clone();
    context.planet.surfaceMesh.worldToLocal(local);
    const uv = vector3ToUV(local);
    const { lat, lon } = vector3ToLatLon(local);

    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: m.targetPos,
      radius: 0.045,
      intensity: 0.75,
      heat: 0.8,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(m.targetPos, m.targetNormal, context.planet.config.radius * 0.35, '#ff8800');
    context.particleSystem.emit(m.targetPos, m.targetNormal, 40, '#ff4400', 1.2, 3.5, 1.0, 0.6);
    context.cameraController.addTrauma(0.2);
    context.audioManager.playMeteorImpact();
  }

  public dispose(): void {
    for (const m of this.activeMeteors) {
      disposeNode(m.mesh);
    }
    this.activeMeteors = [];
    this.rockGeo.dispose();
    this.rockMat.dispose();
  }
}
