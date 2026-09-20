import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { BeamEffect } from '../../effects/BeamEffect';

export class OrbitalLaserWeapon extends Weapon {
  private beam: BeamEffect;
  private isFiring: boolean = false;
  private lastTarget: TargetInfo | null = null;
  private fireDuration: number = 0;

  constructor() {
    super({
      id: 'orbital_laser',
      name: 'Orbital Laser',
      category: 'lasers',
      description: 'Focuses a high-energy particle beam from orbit, carving deep thermal scars and boiling the surface to incandescent slag.',
      cooldownMs: 80,
      iconName: 'Zap',
      keyShortcut: '2',
      damageRadius: 0.022,
      damageIntensity: 0.5,
      requiresHold: true,
    });

    this.beam = new BeamEffect('#00ffff');
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    this.isFiring = true;
    this.lastTarget = target;
    this.lastFiredTime = performance.now();

    if (!this.beam.isActive) {
      context.scene.add(this.beam.group);
      context.audioManager.startLaserHum();
    }

    const emitterPos = target.point.clone().addScaledVector(target.normal, 7.5);
    this.beam.setBeam(emitterPos, target.point);

    // Register thermal incision
    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      lat: target.lat,
      lon: target.lon,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.95,
      timestamp: performance.now(),
    });

    // Intense spark burst
    context.particleSystem.emit(
      target.point,
      target.normal,
      12,
      '#00ffff',
      1.0,
      3.5,
      0.6,
      0.7
    );

    context.cameraController.addTrauma(0.08);
  }

  public update(delta: number, context: WeaponContext): void {
    if (this.isFiring) {
      this.fireDuration += delta;
      // Auto cut-off after 0.25s if single clicked
      if (this.fireDuration > 0.25) {
        this.stopContinuous(context);
      }
    }
  }

  public stopContinuous(context: WeaponContext): void {
    if (this.isFiring) {
      this.isFiring = false;
      this.fireDuration = 0;
      this.beam.hide();
      context.audioManager.stopLaserHum();
    }
  }

  public dispose(): void {
    this.beam.dispose();
  }
}
