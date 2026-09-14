import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';

export class GlassmakerWeapon extends Weapon {
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
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.35, // Obsidian glass crystallization
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(target.point, target.normal, context.planet.config.radius * 0.6, '#33ffff');
    context.particleSystem.emit(target.point, target.normal, 50, '#aaffff', 1.0, 3.5, 1.0, 0.8);
    context.cameraController.addTrauma(0.3);
    context.audioManager.playReset();
  }

  public update(_delta: number, _context: WeaponContext): void {
    // Instant wave weapon
  }
}
