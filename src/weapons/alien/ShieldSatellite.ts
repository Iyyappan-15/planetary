import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveShield {
  satelliteMesh: THREE.Group;
  shieldSphere: THREE.Mesh;
  timer: number;
  duration: number;
}

export class ShieldSatelliteWeapon extends Weapon {
  private activeShields: ActiveShield[] = [];

  constructor() {
    super({
      id: 'shield_satellite',
      name: 'Shield Satellite',
      category: 'alien',
      description: 'Deploys an orbital defense satellite generating a shimmering hexagonal forcefield protecting the planet.',
      cooldownMs: 1200,
      iconName: 'Shield',
      damageRadius: 0.0,
      damageIntensity: 0.0,
    });
  }

  private createSatelliteMesh(): THREE.Group {
    const group = new THREE.Group();

    // Central satellite hub
    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.9, roughness: 0.2 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    group.add(hub);

    // Solar panels
    const panelGeo = new THREE.BoxGeometry(0.6, 0.01, 0.16);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0033aa, metalness: 0.8, roughness: 0.1 });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    group.add(panel);

    return group;
  }

  private createShieldSphere(radius: number): THREE.Mesh {
    const shieldGeo = new THREE.IcosahedronGeometry(radius * 1.15, 3);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00ccff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Mesh(shieldGeo, shieldMat);
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const satPos = target.normal.clone().multiplyScalar(context.planet.config.radius + 1.8);
    const satelliteMesh = this.createSatelliteMesh();
    satelliteMesh.position.copy(satPos);
    satelliteMesh.lookAt(new THREE.Vector3(0, 0, 0));
    context.scene.add(satelliteMesh);

    const shieldSphere = this.createShieldSphere(context.planet.config.radius);
    shieldSphere.position.set(0, 0, 0);
    context.scene.add(shieldSphere);

    this.activeShields.push({
      satelliteMesh,
      shieldSphere,
      timer: 0,
      duration: 8.0, // Active for 8 seconds
    });

    context.audioManager.playShieldDeflect();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeShields.length - 1; i >= 0; i--) {
      const shield = this.activeShields[i];
      shield.timer += delta;

      shield.satelliteMesh.rotation.y += delta * 1.2;
      shield.shieldSphere.rotation.y += delta * 0.4;
      shield.shieldSphere.rotation.x += delta * 0.2;

      // Pulse opacity
      const mat = shield.shieldSphere.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(shield.timer * 4.0) * 0.15;

      if (shield.timer >= shield.duration) {
        context.scene.remove(shield.satelliteMesh);
        context.scene.remove(shield.shieldSphere);
        disposeNode(shield.satelliteMesh);
        disposeNode(shield.shieldSphere);
        this.activeShields.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const s of this.activeShields) {
      disposeNode(s.satelliteMesh);
      disposeNode(s.shieldSphere);
    }
    this.activeShields = [];
  }
}
