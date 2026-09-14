import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveFireball {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  currentRadius: number;
  maxRadius: number;
  expansionSpeed: number;
  opacity: number;
}

export class NuclearBlastWeapon extends Weapon {
  private fireballs: ActiveFireball[] = [];
  private sphereGeo: THREE.SphereGeometry;

  constructor() {
    super({
      id: 'nuclear_blast',
      name: 'Nuclear Blast',
      category: 'explosive',
      description: 'Cinematic thermonuclear detonation releasing a blinding incandescent fireball, supersonic pressure wave, and megacrater.',
      cooldownMs: 800,
      iconName: 'Radiation',
      keyShortcut: '3',
      damageRadius: 0.11,
      damageIntensity: 1.0,
    });

    this.sphereGeo = new THREE.SphereGeometry(1, 32, 32);
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const blastPos = target.point.clone().addScaledVector(target.normal, 0.05);

    // 1. Create expanding fireball sphere
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff5dd,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.position.copy(blastPos);
    mesh.scale.set(0.1, 0.1, 0.1);
    context.scene.add(mesh);

    const maxBlastRadius = context.planet.config.radius * 0.65;
    this.fireballs.push({
      mesh,
      position: blastPos,
      currentRadius: 0.1,
      maxRadius: maxBlastRadius,
      expansionSpeed: maxBlastRadius * 4.0,
      opacity: 1.0,
    });

    // 2. Register massive megacrater in damage system
    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // 3. Shockwave ring expanding across the atmosphere
    context.shockwaveSystem.create(
      target.point,
      target.normal,
      context.planet.config.radius * 0.95,
      '#ffffff'
    );

    // 4. Heavy ejecta debris & glowing thermal particles
    context.particleSystem.emit(
      target.point,
      target.normal,
      120,
      '#ffcc33',
      2.0,
      6.5,
      2.0,
      0.9
    );

    // 5. Heavy camera trauma & audio
    context.cameraController.addTrauma(0.85);
    context.audioManager.playNuclearBlast();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.currentRadius += fb.expansionSpeed * delta;
      const progress = fb.currentRadius / fb.maxRadius;

      if (progress >= 1.0) {
        context.scene.remove(fb.mesh);
        disposeNode(fb.mesh);
        this.fireballs.splice(i, 1);
        continue;
      }

      fb.mesh.scale.set(fb.currentRadius, fb.currentRadius, fb.currentRadius);

      const mat = fb.mesh.material as THREE.MeshBasicMaterial;
      // Transition from white-hot to deep incandescent red
      if (progress < 0.3) {
        mat.color.setHex(0xffffff);
      } else if (progress < 0.6) {
        mat.color.setHex(0xffaa22);
      } else {
        mat.color.setHex(0xff3300);
      }
      mat.opacity = (1.0 - progress) * 0.95;
    }
  }

  public dispose(): void {
    for (const fb of this.fireballs) {
      disposeNode(fb.mesh);
    }
    this.fireballs = [];
    this.sphereGeo.dispose();
  }
}
