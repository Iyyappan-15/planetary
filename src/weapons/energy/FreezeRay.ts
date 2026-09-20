import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

export class FreezeRayWeapon extends Weapon {
  private beamMesh: THREE.Mesh | null = null;
  private glowMesh: THREE.Mesh | null = null;
  private isFiring: boolean = false;

  constructor() {
    super({
      id: 'freeze_ray',
      name: 'Freeze Ray',
      category: 'lasers',
      description: 'Cryogenic beam that flash-freezes oceans and continents into gleaming white ice sheets.',
      cooldownMs: 50,
      iconName: 'Snowflake',
      keyShortcut: '7',
      damageRadius: 0.045,
      damageIntensity: 0.35,
      requiresHold: true,
    });
  }

  private initBeam(scene: THREE.Scene): void {
    if (this.beamMesh) return;

    // Cyan-white cryogenic core
    const beamGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xeeffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.visible = false;
    scene.add(this.beamMesh);

    // Deep cyan frost aura
    const glowGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.glowMesh.visible = false;
    scene.add(this.glowMesh);
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    this.initBeam(context.scene);
    this.isFiring = true;

    const origin = context.cameraController.camera.position.clone()
      .addScaledVector(context.cameraController.camera.getWorldDirection(new THREE.Vector3()), 0.5);

    const dist = origin.distanceTo(target.point);
    const mid = origin.clone().lerp(target.point, 0.5);

    if (this.beamMesh && this.glowMesh) {
      this.beamMesh.visible = true;
      this.beamMesh.position.copy(mid);
      this.beamMesh.scale.set(1, dist, 1);
      this.beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.point.clone().sub(origin).normalize());

      this.glowMesh.visible = true;
      this.glowMesh.position.copy(mid);
      this.glowMesh.scale.set(1, dist, 1);
      this.glowMesh.quaternion.copy(this.beamMesh.quaternion);
    }

    if (this.canFire()) {
      this.lastFiredTime = performance.now();

      // Register freeze impact with type: 'freeze'
      context.planet.registerImpact({
        u: target.uv.u,
        v: target.uv.v,
        lat: target.lat,
        lon: target.lon,
        position: target.point,
        radius: this.config.damageRadius,
        intensity: this.config.damageIntensity,
        heat: 0.0,
        timestamp: performance.now(),
        type: 'freeze',
      });

      // Ice crystal mist particles
      context.particleSystem.emit(
        target.point,
        target.normal,
        8,
        '#d0f5ff',
        0.5,
        1.2,
        0.3,
        0.15
      );

      context.audioManager.playFreezeRay();
    }
  }

  public stopContinuous(_context: WeaponContext): void {
    this.isFiring = false;
    if (this.beamMesh) this.beamMesh.visible = false;
    if (this.glowMesh) this.glowMesh.visible = false;
  }

  public update(_delta: number, _context: WeaponContext): void {
    if (!this.isFiring) {
      if (this.beamMesh) this.beamMesh.visible = false;
      if (this.glowMesh) this.glowMesh.visible = false;
    }
  }

  public dispose(): void {
    if (this.beamMesh) disposeNode(this.beamMesh);
    if (this.glowMesh) disposeNode(this.glowMesh);
    this.beamMesh = null;
    this.glowMesh = null;
  }
}
