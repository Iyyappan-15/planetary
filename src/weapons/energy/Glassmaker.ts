import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { BeamEffect } from '../../effects/BeamEffect';

export class GlassmakerWeapon extends Weapon {
  private beam: BeamEffect;
  private isFiring: boolean = false;
  private duration: number = 0;

  constructor() {
    super({
      id: 'planetary_glassmaker',
      name: 'Glassmaker',
      category: 'energy',
      description: 'Ultra-high frequency thermal wave instantly vitrifying land and oceans into reflective dark glass.',
      cooldownMs: 1000,
      iconName: 'Sparkles',
      keyShortcut: '9',
      damageRadius: 0.09,
      damageIntensity: 0.65,
    });

    this.beam = new BeamEffect('#00ffff');
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();
    this.isFiring = true;
    this.duration = 0;

    // Fire crystalline beam from orbit
    if (!this.beam.isActive) {
      context.scene.add(this.beam.group);
    }
    const emitterPos = target.point.clone().addScaledVector(target.normal, 8.5);
    this.beam.setBeam(emitterPos, target.point);

    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      lat: target.lat,
      lon: target.lon,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.35, // Obsidian glass crystallization
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(target.point, target.normal, context.planet.config.radius * 0.6, '#33ffff');
    context.particleSystem.emit(target.point, target.normal, 65, '#aaffff', 1.0, 3.5, 1.0, 0.8);
    context.cameraController.addTrauma(0.35);
    context.audioManager.playReset();
  }

  public update(delta: number, _context: WeaponContext): void {
    if (this.isFiring) {
      this.duration += delta;
      if (this.duration > 0.4) {
        this.isFiring = false;
        this.beam.hide();
      }
    }
  }

  public dispose(): void {
    this.beam.dispose();
  }
}
