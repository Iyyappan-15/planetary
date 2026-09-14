import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveTear {
  mesh: THREE.Mesh;
  duration: number;
  maxDuration: number;
}

export class SpaceTearWeapon extends Weapon {
  private tears: ActiveTear[] = [];

  constructor() {
    super({
      id: 'space_tear',
      name: 'Space-Time Tear',
      category: 'cosmic',
      description: 'Rips a luminous chromatic fissure in the fabric of space, destabilizing local matter.',
      cooldownMs: 1800,
      iconName: 'Maximize2',
      keyShortcut: '8',
      damageRadius: 0.12,
      damageIntensity: 1.1,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const planeGeo = new THREE.PlaneGeometry(1.6, 0.25, 8, 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.position.copy(target.point.clone().addScaledVector(target.normal, 0.4));
    mesh.lookAt(target.point.clone().add(target.normal));
    mesh.rotation.z = Math.random() * Math.PI;

    context.scene.add(mesh);

    this.tears.push({
      mesh,
      duration: 0,
      maxDuration: 3.5,
    });

    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      lat: target.lat,
      lon: target.lon,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.85,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(target.point, target.normal, context.planet.config.radius * 0.7, '#ff00aa');
    context.particleSystem.emit(target.point, target.normal, 60, '#00ffff', 1.0, 4.0, 1.2, 0.6);
    context.cameraController.addTrauma(0.5);
    context.audioManager.playGravityPulse();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.tears.length - 1; i >= 0; i--) {
      const tear = this.tears[i];
      tear.duration += delta;

      if (tear.duration >= tear.maxDuration) {
        context.scene.remove(tear.mesh);
        disposeNode(tear.mesh);
        this.tears.splice(i, 1);
        continue;
      }

      // Chromatic flickering
      const mat = tear.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHSL((tear.duration * 2.0) % 1.0, 1.0, 0.6);
      const pulse = 1.0 + Math.sin(tear.duration * 18.0) * 0.2;
      tear.mesh.scale.set(pulse, pulse, pulse);
    }
  }

  public dispose(): void {
    for (const t of this.tears) {
      disposeNode(t.mesh);
    }
    this.tears = [];
  }
}
