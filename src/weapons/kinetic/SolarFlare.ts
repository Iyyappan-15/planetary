import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveFlare {
  flareWave: THREE.Mesh;
  direction: THREE.Vector3;
  timer: number;
  duration: number;
  hasSwept: boolean;
}

export class SolarFlareWeapon extends Weapon {
  private activeFlares: ActiveFlare[] = [];

  constructor() {
    super({
      id: 'solar_flare',
      name: 'Solar Flare',
      category: 'celestial',
      description: 'Catastrophic coronal mass ejection from the Sun sweeps across the planet, scorching the atmosphere and boiling seas.',
      cooldownMs: 2800,
      iconName: 'Flame',
      damageRadius: 0.26,
      damageIntensity: 1.7,
    });
  }

  private createWaveMesh(): THREE.Mesh {
    const waveGeo = new THREE.CylinderGeometry(3.5, 4.2, 0.4, 32, 1, true);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const wave = new THREE.Mesh(waveGeo, waveMat);
    wave.rotation.x = Math.PI / 2;
    return wave;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const sunDir = target.normal.clone();
    const spawnPos = sunDir.clone().multiplyScalar(12.0);

    const wave = this.createWaveMesh();
    wave.position.copy(spawnPos);
    wave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sunDir);
    context.scene.add(wave);

    this.activeFlares.push({
      flareWave: wave,
      direction: sunDir,
      timer: 0,
      duration: 4.5,
      hasSwept: false,
    });

    context.audioManager.playSolarFlare();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeFlares.length - 1; i >= 0; i--) {
      const f = this.activeFlares[i];
      f.timer += delta;

      // Flare sweeps across from 12.0 to -12.0 units
      const progress = Math.min(1.0, f.timer / 2.8);
      const currentPos = f.direction.clone().multiplyScalar(12.0 - progress * 24.0);
      f.flareWave.position.copy(currentPos);

      // Trailing coronal fire plasma
      context.particleSystem.emit(
        f.flareWave.position,
        f.direction,
        6,
        '#ffaa00',
        1.5,
        4.0,
        0.5,
        0.3
      );

      // When passing through the planet center (progress ~ 0.5)
      if (progress >= 0.5 && !f.hasSwept) {
        f.hasSwept = true;

        const impactPoint = f.direction.clone().multiplyScalar(context.planet.config.radius);

        context.planet.registerImpact({
          u: 0.5,
          v: 0.5,
          position: impactPoint,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 1.0,
          timestamp: performance.now(),
        });

        context.shockwaveSystem.create(impactPoint, f.direction, context.planet.config.radius * 1.5, '#ff8800');
        context.cameraController.addTrauma(0.65);
      }

      if (f.timer >= f.duration) {
        context.scene.remove(f.flareWave);
        disposeNode(f.flareWave);
        this.activeFlares.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const f of this.activeFlares) {
      disposeNode(f.flareWave);
    }
    this.activeFlares = [];
  }
}
