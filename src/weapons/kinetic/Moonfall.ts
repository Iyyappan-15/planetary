import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveMoon {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
}

export class MoonfallWeapon extends Weapon {
  private moons: ActiveMoon[] = [];
  private geo: THREE.SphereGeometry;
  private mat: THREE.MeshStandardMaterial;

  constructor() {
    super({
      id: 'moonfall',
      name: 'Moonfall',
      category: 'kinetic',
      description: 'Summons a rogue satellite moon from deep space and sends it crashing into the planetary core.',
      cooldownMs: 3000,
      iconName: 'Moon',
      damageRadius: 0.28,
      damageIntensity: 2.0,
    });

    this.geo = new THREE.SphereGeometry(1.1, 32, 32);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 16.0);
    const mesh = new THREE.Mesh(this.geo, this.mat.clone());
    mesh.position.copy(startPos);
    context.scene.add(mesh);

    this.moons.push({
      mesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
    });
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.moons.length - 1; i >= 0; i--) {
      const m = this.moons[i];
      m.progress += delta * 1.8;

      if (m.progress >= 1.0) {
        // Cataclysmic extinction impact
        context.planet.registerImpact({
          u: m.targetUV.u,
          v: m.targetUV.v,
          lat: m.targetLat,
          lon: m.targetLon,
          position: m.targetPos,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 1.0,
          timestamp: performance.now(),
        });

        // Massive planetary breakup trigger
        context.planet.triggerBreakup(m.targetPos);

        context.shockwaveSystem.create(m.targetPos, m.targetNormal, context.planet.config.radius * 1.8, '#ff9900');
        context.particleSystem.emit(m.targetPos, m.targetNormal, 150, '#ff7700', 3.0, 9.0, 2.5, 1.0);
        context.cameraController.addTrauma(1.0);
        context.audioManager.playNuclearBlast();

        context.scene.remove(m.mesh);
        disposeNode(m.mesh);
        this.moons.splice(i, 1);
        continue;
      }

      m.mesh.position.lerpVectors(m.startPos, m.targetPos, m.progress);
      m.mesh.rotation.y += delta * 2.0;

      // Atmospheric shock cone
      context.particleSystem.emit(m.mesh.position, m.targetNormal, 6, '#ffaa44', 0.8, 2.5, 0.5, 0.4);
    }
  }

  public dispose(): void {
    for (const m of this.moons) {
      disposeNode(m.mesh);
    }
    this.moons = [];
    this.geo.dispose();
    this.mat.dispose();
  }
}
