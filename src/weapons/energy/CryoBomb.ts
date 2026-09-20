import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveCryo {
  mesh: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
  hasDetonated: boolean;
}

export class CryoBombWeapon extends Weapon {
  private activeBombs: ActiveCryo[] = [];

  constructor() {
    super({
      id: 'cryo_bomb',
      name: 'Cryo Freeze Bomb',
      category: 'lasers',
      description: 'Absolute-zero warhead that detonates in the atmosphere, creating an expanding frost wave that glazes continents in ice.',
      cooldownMs: 1900,
      iconName: 'Snowflake',
      damageRadius: 0.15,
      damageIntensity: 0.85,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 5.5);
    const geo = new THREE.IcosahedronGeometry(0.18, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x88eeff,
      emissive: 0x00aacc,
      roughness: 0.1,
      metalness: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    context.scene.add(mesh);

    this.activeBombs.push({
      mesh,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 3.5,
      hasDetonated: false,
    });

    context.audioManager.playUiClick();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeBombs.length - 1; i >= 0; i--) {
      const b = this.activeBombs[i];
      b.timer += delta;

      if (!b.hasDetonated) {
        const fallT = Math.min(1.0, b.timer / 1.0);
        const start = b.targetPos.clone().addScaledVector(b.targetNormal, 5.5);
        b.mesh.position.lerpVectors(start, b.targetPos, fallT * fallT);
        b.mesh.rotation.x += delta * 4.0;
        b.mesh.rotation.y += delta * 6.0;

        if (fallT >= 1.0) {
          b.hasDetonated = true;
          b.mesh.visible = false;
          this.onDetonation(b, context);
        }
      }

      if (b.timer >= b.duration) {
        context.scene.remove(b.mesh);
        disposeNode(b.mesh);
        this.activeBombs.splice(i, 1);
      }
    }
  }

  private onDetonation(b: ActiveCryo, context: WeaponContext): void {
    const local = b.targetPos.clone();
    context.planet.surfaceMesh.worldToLocal(local);
    const uv = vector3ToUV(local);
    const { lat, lon } = vector3ToLatLon(local);

    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: b.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.0,
      timestamp: performance.now(),
      type: 'freeze',
    });

    // Expanding crystalline frost shockwave
    context.shockwaveSystem.create(b.targetPos, b.targetNormal, context.planet.config.radius * 1.1, '#88eeff');
    context.particleSystem.emit(b.targetPos, b.targetNormal, 70, '#ffffff', 2.0, 4.5, 1.8, 0.8);
    context.particleSystem.emit(b.targetPos, b.targetNormal, 50, '#88ddff', 1.5, 3.5, 1.4, 0.6);
    context.cameraController.addTrauma(0.4);
    context.audioManager.playCryoFreeze();
  }

  public dispose(): void {
    for (const b of this.activeBombs) {
      disposeNode(b.mesh);
    }
    this.activeBombs = [];
  }
}
