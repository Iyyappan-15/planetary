import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActivePlasma {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  progress: number;
}

export class PlasmaBeamWeapon extends Weapon {
  private plasmas: ActivePlasma[] = [];
  private geo: THREE.SphereGeometry;

  constructor() {
    super({
      id: 'plasma_beam',
      name: 'Plasma Beam',
      category: 'energy',
      description: 'Concentrated superheated plasma burst causing catastrophic thermal vaporization.',
      cooldownMs: 600,
      iconName: 'Sun',
      keyShortcut: '6',
      damageRadius: 0.07,
      damageIntensity: 0.85,
    });
    this.geo = new THREE.SphereGeometry(0.35, 16, 16);
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 9.0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.copy(startPos);
    context.scene.add(mesh);

    this.plasmas.push({
      mesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      progress: 0,
    });
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.plasmas.length - 1; i >= 0; i--) {
      const p = this.plasmas[i];
      p.progress += delta * 6.5;

      if (p.progress >= 1.0) {
        // Impact
        context.planet.registerImpact({
          u: p.targetUV.u,
          v: p.targetUV.v,
          position: p.targetPos,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 0.95,
          timestamp: performance.now(),
        });

        context.shockwaveSystem.create(p.targetPos, p.targetNormal, context.planet.config.radius * 0.5, '#00ffaa');
        context.particleSystem.emit(p.targetPos, p.targetNormal, 70, '#00ffaa', 1.5, 5.0, 1.2, 0.8);
        context.cameraController.addTrauma(0.45);
        context.audioManager.playMeteorImpact();

        context.scene.remove(p.mesh);
        disposeNode(p.mesh);
        this.plasmas.splice(i, 1);
        continue;
      }

      p.mesh.position.lerpVectors(p.startPos, p.targetPos, p.progress);
      context.particleSystem.emit(p.mesh.position, p.targetNormal, 2, '#33ffbb', 0.2, 0.8, 0.2, 0.2);
    }
  }

  public dispose(): void {
    for (const p of this.plasmas) {
      disposeNode(p.mesh);
    }
    this.plasmas = [];
    this.geo.dispose();
  }
}
