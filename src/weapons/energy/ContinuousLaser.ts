import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

export class ContinuousLaserWeapon extends Weapon {
  private beamMesh: THREE.Mesh | null = null;
  private glowMesh: THREE.Mesh | null = null;
  private isFiring: boolean = false;
  private lastTarget: TargetInfo | null = null;

  constructor() {
    super({
      id: 'continuous_laser',
      name: 'Continuous Laser',
      category: 'lasers',
      description: 'Hold and drag across the planet to carve continuous molten incandescent trenches.',
      cooldownMs: 40,
      iconName: 'Zap',
      keyShortcut: '6',
      damageRadius: 0.025,
      damageIntensity: 0.5,
      requiresHold: true,
    });
  }

  private initBeam(scene: THREE.Scene): void {
    if (this.beamMesh) return;

    // Inner bright core
    const beamGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.visible = false;
    scene.add(this.beamMesh);

    // Outer fiery glow
    const glowGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.glowMesh.visible = false;
    scene.add(this.glowMesh);
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    this.initBeam(context.scene);
    this.isFiring = true;
    this.lastTarget = target;

    const origin = context.cameraController.camera.position.clone()
      .addScaledVector(context.cameraController.camera.getWorldDirection(new THREE.Vector3()), 0.5);

    this.updateBeamGeometry(origin, target.point);

    if (this.canFire()) {
      this.lastFiredTime = performance.now();

      // Carve trench on planet
      context.planet.registerImpact({
        u: target.uv.u,
        v: target.uv.v,
        lat: target.lat,
        lon: target.lon,
        position: target.point,
        radius: this.config.damageRadius,
        intensity: this.config.damageIntensity,
        heat: 0.9,
        timestamp: performance.now(),
        type: 'laser',
      });

      // Molten spark splash
      context.particleSystem.emit(
        target.point,
        target.normal,
        6,
        '#ffaa00',
        0.4,
        1.5,
        0.2,
        0.1
      );

      context.cameraController.addTrauma(0.03);
      context.audioManager.startLaserHum();
    }
  }

  private updateBeamGeometry(from: THREE.Vector3, to: THREE.Vector3): void {
    if (!this.beamMesh || !this.glowMesh) return;

    const dist = from.distanceTo(to);
    const mid = from.clone().lerp(to, 0.5);

    this.beamMesh.visible = true;
    this.beamMesh.position.copy(mid);
    this.beamMesh.scale.set(1, dist, 1);
    this.beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());

    this.glowMesh.visible = true;
    this.glowMesh.position.copy(mid);
    this.glowMesh.scale.set(1, dist, 1);
    this.glowMesh.quaternion.copy(this.beamMesh.quaternion);
  }

  public stopContinuous(context: WeaponContext): void {
    this.isFiring = false;
    if (this.beamMesh) this.beamMesh.visible = false;
    if (this.glowMesh) this.glowMesh.visible = false;
    context.audioManager.stopLaserHum();
  }

  public update(_delta: number, context: WeaponContext): void {
    if (!this.isFiring) {
      if (this.beamMesh) this.beamMesh.visible = false;
      if (this.glowMesh) this.glowMesh.visible = false;
      context.audioManager.stopLaserHum();
    }
  }

  public dispose(): void {
    if (this.beamMesh) disposeNode(this.beamMesh);
    if (this.glowMesh) disposeNode(this.glowMesh);
    this.beamMesh = null;
    this.glowMesh = null;
  }
}
