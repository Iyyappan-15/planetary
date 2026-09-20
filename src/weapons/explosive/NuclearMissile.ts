import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveMissile {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
  speed: number;
  midArcPos: THREE.Vector3;
}

export class NuclearMissileWeapon extends Weapon {
  private activeMissiles: ActiveMissile[] = [];

  constructor() {
    super({
      id: 'nuclear_missile',
      name: 'Nuclear Missile',
      category: 'explosives',
      description: 'Long-range ICBM with rocket exhaust trail that detonates in a blinding thermonuclear fireball.',
      cooldownMs: 650,
      iconName: 'Rocket',
      keyShortcut: '1',
      damageRadius: 0.08,
      damageIntensity: 1.0,
    });
  }

  private createMissileMesh(): THREE.Group {
    const group = new THREE.Group();

    // 1. Rocket body
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.45, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.8,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // 2. Warhead nosecone (hazard tip)
    const noseGeo = new THREE.ConeGeometry(0.045, 0.16, 12);
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xee2222,
      roughness: 0.4,
    });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.28;
    group.add(nose);

    // 3. Four tail fins
    const finGeo = new THREE.BoxGeometry(0.18, 0.015, 0.08);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });
    const fin1 = new THREE.Mesh(finGeo, finMat);
    fin1.position.z = -0.18;
    group.add(fin1);

    const fin2 = new THREE.Mesh(finGeo, finMat);
    fin2.position.z = -0.18;
    fin2.rotation.z = Math.PI / 2;
    group.add(fin2);

    // 4. Thruster glow point light
    const thrusterGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.z = -0.23;
    group.add(thruster);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // Spawn high above in space with ballistic entry angle
    const startPos = target.point.clone().addScaledVector(target.normal, 9.0);
    startPos.x += (Math.random() - 0.5) * 4.0;
    startPos.y += (Math.random() - 0.5) * 4.0;

    // Mid-arc apex point for natural curved trajectory
    const midPos = startPos.clone().lerp(target.point, 0.5).addScaledVector(target.normal, 2.5);

    const group = this.createMissileMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activeMissiles.push({
      group,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
      speed: 1.4, // Flight time ~0.7s
      midArcPos: midPos,
    });

    context.audioManager.playMissileLaunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
      const missile = this.activeMissiles[i];
      missile.progress += missile.speed * delta;

      if (missile.progress >= 1.0) {
        this.onImpact(missile, context);
        context.scene.remove(missile.group);
        disposeNode(missile.group);
        this.activeMissiles.splice(i, 1);
        continue;
      }

      // Quadratic bezier curve along ballistic trajectory
      const t = missile.progress;
      const invT = 1.0 - t;
      const currentPos = new THREE.Vector3()
        .addScaledVector(missile.startPos, invT * invT)
        .addScaledVector(missile.midArcPos, 2 * invT * t)
        .addScaledVector(missile.targetPos, t * t);

      // Tangent vector for missile orientation
      const nextT = Math.min(1.0, t + 0.04);
      const invNextT = 1.0 - nextT;
      const nextPos = new THREE.Vector3()
        .addScaledVector(missile.startPos, invNextT * invNextT)
        .addScaledVector(missile.midArcPos, 2 * invNextT * nextT)
        .addScaledVector(missile.targetPos, nextT * nextT);

      missile.group.position.copy(currentPos);
      missile.group.lookAt(nextPos);

      // White/orange smoke exhaust trail particles
      context.particleSystem.emit(
        currentPos,
        missile.targetNormal,
        3,
        t > 0.6 ? '#ffffff' : '#ff7700',
        0.18,
        0.8,
        0.25,
        0.18
      );
    }
  }

  private onImpact(missile: ActiveMissile, context: WeaponContext): void {
    // 1. Planetary damage crater
    context.planet.registerImpact({
      u: missile.targetUV.u,
      v: missile.targetUV.v,
      lat: missile.targetLat,
      lon: missile.targetLon,
      position: missile.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.95,
      timestamp: performance.now(),
    });

    // 2. Shockwave ring
    context.shockwaveSystem.create(
      missile.targetPos,
      missile.targetNormal,
      context.planet.config.radius * 0.55,
      '#ffeedd'
    );

    // 3. Nuclear fireball ejecta
    context.particleSystem.emit(
      missile.targetPos,
      missile.targetNormal,
      80,
      '#ffeedd',
      2.0,
      5.2,
      1.6,
      0.9
    );

    context.cameraController.addTrauma(0.45);
    context.audioManager.playNuclearDetonation();
  }

  public dispose(): void {
    for (const m of this.activeMissiles) {
      disposeNode(m.group);
    }
    this.activeMissiles = [];
  }
}
