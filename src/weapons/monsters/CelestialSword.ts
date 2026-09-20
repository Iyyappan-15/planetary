import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveSword {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  timer: number;
  hasImpaled: boolean;
  lingerTimer: number;
}

export class CelestialSwordWeapon extends Weapon {
  private activeSwords: ActiveSword[] = [];

  constructor() {
    super({
      id: 'celestial_sword',
      name: 'Celestial Sword',
      category: 'monsters',
      description: 'Colossal divine blade of starlight falling from deep space, impaling deep into the planetary mantle and detonating the core.',
      cooldownMs: 2600,
      iconName: 'Sword',
      damageRadius: 0.18,
      damageIntensity: 1.8,
    });
  }

  private createSwordMesh(): THREE.Group {
    const group = new THREE.Group();

    // Divine glowing blade material
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x88ccff,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff4400,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });

    // 1. Double-edged diamond cross-section blade
    const bladeGeo = new THREE.CylinderGeometry(0.04, 0.22, 5.5, 4);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.scale.set(0.3, 1, 1);
    blade.position.set(0, 0, 2.75);
    blade.rotation.x = Math.PI / 2;
    group.add(blade);

    // Central fuller glowing spine
    const fullerGeo = new THREE.BoxGeometry(0.02, 0.05, 5.0);
    const fullerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const fuller = new THREE.Mesh(fullerGeo, fullerMat);
    fuller.position.set(0, 0, 2.5);
    group.add(fuller);

    // 2. Ornate Crossguard
    const guardGeo = new THREE.BoxGeometry(1.6, 0.2, 0.25);
    const guard = new THREE.Mesh(guardGeo, goldMat);
    guard.position.set(0, 0, 0);
    group.add(guard);

    // 3. Runic Grip / Hilt
    const gripGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12);
    const grip = new THREE.Mesh(gripGeo, bladeMat);
    grip.position.set(0, 0, -0.6);
    grip.rotation.x = Math.PI / 2;
    group.add(grip);

    // 4. Starlight Crystal Pommel
    const pommelGeo = new THREE.OctahedronGeometry(0.2);
    const pommel = new THREE.Mesh(pommelGeo, goldMat);
    pommel.position.set(0, 0, -1.3);
    group.add(pommel);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 11.0);
    const group = this.createSwordMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activeSwords.push({
      group,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      timer: 0,
      hasImpaled: false,
      lingerTimer: 2.8,
    });

    context.audioManager.playCelestialSword();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeSwords.length - 1; i >= 0; i--) {
      const sword = this.activeSwords[i];
      sword.timer += delta;

      if (!sword.hasImpaled) {
        // Fall duration ~1.3 seconds with accelerating plunge
        const fallT = Math.min(1.0, sword.timer / 1.3);
        const easeIn = Math.pow(fallT, 2.5);

        sword.group.position.lerpVectors(sword.startPos, sword.targetPos, easeIn);

        // Trailing holy starlight sparks
        context.particleSystem.emit(
          sword.group.position,
          sword.targetNormal,
          4,
          '#aaccff',
          0.4,
          1.5,
          0.3,
          0.2
        );

        if (fallT >= 1.0) {
          sword.hasImpaled = true;
          // Sink blade 1.8 units into the crust and mantle
          sword.group.position.copy(sword.targetPos).addScaledVector(sword.targetNormal, -1.8);
          this.onImpalement(sword, context);
        }
      } else {
        // Embedded in the planet: radiating core magma
        sword.lingerTimer -= delta;

        if (Math.random() < 0.3) {
          context.particleSystem.emit(
            sword.targetPos,
            sword.targetNormal,
            3,
            '#ff5500',
            0.5,
            2.0,
            0.4,
            0.2
          );
        }

        // Dissolve into starlight in final 0.8s
        if (sword.lingerTimer <= 0.8) {
          const fade = Math.max(0, sword.lingerTimer / 0.8);
          sword.group.scale.set(fade, fade, fade);
        }

        if (sword.lingerTimer <= 0) {
          context.scene.remove(sword.group);
          disposeNode(sword.group);
          this.activeSwords.splice(i, 1);
        }
      }
    }
  }

  private onImpalement(s: ActiveSword, context: WeaponContext): void {
    context.planet.registerImpact({
      u: s.targetUV.u,
      v: s.targetUV.v,
      lat: s.targetLat,
      lon: s.targetLon,
      position: s.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // Colossal planar shockwaves
    context.shockwaveSystem.create(s.targetPos, s.targetNormal, context.planet.config.radius * 1.1, '#00ffff');
    context.shockwaveSystem.create(s.targetPos, s.targetNormal, context.planet.config.radius * 0.6, '#ffffff');

    // Magma blowout & holy sparks
    context.particleSystem.emit(s.targetPos, s.targetNormal, 90, '#00ffff', 2.5, 6.0, 1.8, 0.9);
    context.particleSystem.emit(s.targetPos, s.targetNormal, 60, '#ffaa00', 2.0, 4.5, 1.5, 0.7);

    context.cameraController.addTrauma(0.8);
    context.audioManager.playCelestialSword();
  }

  public dispose(): void {
    for (const s of this.activeSwords) {
      disposeNode(s.group);
    }
    this.activeSwords = [];
  }
}
