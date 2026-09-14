import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveHole {
  group: THREE.Group;
  position: THREE.Vector3;
  duration: number;
  maxDuration: number;
}

export class MiniBlackHoleWeapon extends Weapon {
  private holes: ActiveHole[] = [];

  constructor() {
    super({
      id: 'mini_black_hole',
      name: 'Mini Black Hole',
      category: 'cosmic',
      description: 'Cosmic micro-singularity with an intense gravitational gradient that tears matter apart and swallows planetary crust.',
      cooldownMs: 2500,
      iconName: 'Disc',
      keyShortcut: '7',
      damageRadius: 0.22,
      damageIntensity: 1.5,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const holePos = target.point.clone().addScaledVector(target.normal, 1.2);
    const group = new THREE.Group();
    group.position.copy(holePos);

    // Event Horizon sphere
    const sphereGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(core);

    // Blazing accretion disc
    const ringGeo = new THREE.RingGeometry(0.42, 1.3, 32);
    ringGeo.rotateX(-Math.PI / 2.2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(ringGeo, ringMat);
    group.add(disc);

    context.scene.add(group);

    this.holes.push({
      group,
      position: holePos,
      duration: 0,
      maxDuration: 6.0,
    });

    // Massive damage
    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      lat: target.lat,
      lon: target.lon,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    context.cameraController.addTrauma(0.6);
    context.audioManager.playGravityPulse();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i];
      h.duration += delta;

      if (h.duration >= h.maxDuration) {
        context.scene.remove(h.group);
        disposeNode(h.group);
        this.holes.splice(i, 1);
        continue;
      }

      // Rotate accretion disc
      h.group.rotation.y += delta * 6.0;

      // Debris swirl
      if (Math.random() < 0.4) {
        const offset = new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
        const spawn = h.position.clone().add(offset);
        const pull = h.position.clone().sub(spawn).normalize();
        context.particleSystem.emit(spawn, pull, 5, '#ffaa33', 1.5, 4.0, 0.5, 0.1);
      }
    }
  }

  public dispose(): void {
    for (const h of this.holes) {
      disposeNode(h.group);
    }
    this.holes = [];
  }
}
