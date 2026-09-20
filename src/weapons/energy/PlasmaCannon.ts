import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveBolt {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
  speed: number;
}

export class PlasmaCannonWeapon extends Weapon {
  private activeBolts: ActiveBolt[] = [];
  private boltGeo: THREE.SphereGeometry;
  private boltMat: THREE.MeshBasicMaterial;

  constructor() {
    super({
      id: 'plasma_cannon',
      name: 'Plasma Cannon',
      category: 'lasers',
      description: 'Fires high-velocity spherical bolts of superheated plasma, causing catastrophic thermal vaporization.',
      cooldownMs: 350,
      iconName: 'Sun',
      keyShortcut: '8',
      damageRadius: 0.065,
      damageIntensity: 0.85,
    });

    this.boltGeo = new THREE.SphereGeometry(0.08, 12, 12);
    this.boltMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = context.cameraController.camera.position.clone()
      .addScaledVector(context.cameraController.camera.getWorldDirection(new THREE.Vector3()), 0.5);

    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat.clone());
    mesh.position.copy(startPos);
    context.scene.add(mesh);

    this.activeBolts.push({
      mesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
      speed: 1.8, // ~0.55s visible projectile flight
    });

    context.audioManager.playPlasmaBlast();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeBolts[i];
      bolt.progress += bolt.speed * delta;

      if (bolt.progress >= 1.0) {
        this.onImpact(bolt, context);
        context.scene.remove(bolt.mesh);
        disposeNode(bolt.mesh);
        this.activeBolts.splice(i, 1);
        continue;
      }

      bolt.mesh.position.lerpVectors(bolt.startPos, bolt.targetPos, bolt.progress);

      // Cyan plasma trail
      context.particleSystem.emit(
        bolt.mesh.position,
        bolt.targetNormal,
        3,
        '#00ffff',
        0.15,
        0.6,
        0.18,
        0.1
      );
    }
  }

  private onImpact(bolt: ActiveBolt, context: WeaponContext): void {
    context.planet.registerImpact({
      u: bolt.targetUV.u,
      v: bolt.targetUV.v,
      lat: bolt.targetLat,
      lon: bolt.targetLon,
      position: bolt.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.9,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(bolt.targetPos, bolt.targetNormal, context.planet.config.radius * 0.35, '#00ffff');
    context.particleSystem.emit(bolt.targetPos, bolt.targetNormal, 45, '#00eeff', 1.2, 3.2, 0.9, 0.5);
    context.cameraController.addTrauma(0.2);
    context.audioManager.playPlasmaBlast();
  }

  public dispose(): void {
    for (const b of this.activeBolts) {
      disposeNode(b.mesh);
    }
    this.activeBolts = [];
    this.boltGeo.dispose();
    this.boltMat.dispose();
  }
}
