import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveStomp {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  timer: number;
  hasStomped: boolean;
  lingerTimer: number;
}

export class TitanStompWeapon extends Weapon {
  private activeStomps: ActiveStomp[] = [];

  constructor() {
    super({
      id: 'titan_stomp',
      name: 'Titan Stomp',
      category: 'monsters',
      description: 'Gargantuan cosmic deity foot emerging from orbital clouds to deliver an earth-shattering stomp that flattens continental crust.',
      cooldownMs: 2500,
      iconName: 'Footprints',
      damageRadius: 0.22,
      damageIntensity: 1.7,
    });
  }

  private createLegMesh(): THREE.Group {
    const group = new THREE.Group();

    const titanMat = new THREE.MeshStandardMaterial({
      color: 0x221833,
      emissive: 0x440066,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff3300,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.9,
    });

    // 1. Lower leg shin / calf cylinder
    const legGeo = new THREE.CylinderGeometry(0.5, 0.7, 3.2, 16);
    const leg = new THREE.Mesh(legGeo, titanMat);
    leg.position.set(0, 1.8, -0.3);
    group.add(leg);

    // Shin armored greave plate
    const greaveGeo = new THREE.BoxGeometry(0.5, 2.6, 0.3);
    const greave = new THREE.Mesh(greaveGeo, goldMat);
    greave.position.set(0, 1.8, 0.15);
    group.add(greave);

    // 2. Ankle joint
    const ankleGeo = new THREE.SphereGeometry(0.52, 16, 16);
    const ankle = new THREE.Mesh(ankleGeo, goldMat);
    ankle.position.set(0, 0.45, -0.1);
    group.add(ankle);

    // 3. Colossal Foot
    const footGeo = new THREE.BoxGeometry(1.1, 0.45, 1.8);
    const foot = new THREE.Mesh(footGeo, titanMat);
    foot.position.set(0, 0.2, 0.3);
    group.add(foot);

    // Sole strike plate (gold energy base)
    const soleGeo = new THREE.BoxGeometry(1.05, 0.1, 1.75);
    const sole = new THREE.Mesh(soleGeo, goldMat);
    sole.position.set(0, -0.05, 0.3);
    group.add(sole);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 8.5);
    const group = this.createLegMesh();
    group.position.copy(startPos);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.normal);
    context.scene.add(group);

    this.activeStomps.push({
      group,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      timer: 0,
      hasStomped: false,
      lingerTimer: 2.2,
    });

    context.audioManager.playTitanStomp();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeStomps.length - 1; i >= 0; i--) {
      const s = this.activeStomps[i];
      s.timer += delta;

      if (!s.hasStomped) {
        // Stomp descent time: 1.2s
        const t = Math.min(1.0, s.timer / 1.2);
        const easeIn = Math.pow(t, 2.4);

        s.group.position.lerpVectors(s.startPos, s.targetPos, easeIn);

        // Thunderous cosmic energy aura
        context.particleSystem.emit(
          s.group.position,
          s.targetNormal,
          3,
          '#aa00ff',
          0.4,
          1.2,
          0.3,
          0.2
        );

        if (t >= 1.0) {
          s.hasStomped = true;
          s.group.position.copy(s.targetPos);
          this.onStomp(s, context);
        }
      } else {
        s.lingerTimer -= delta;

        // Ground tremor sparks
        if (Math.random() < 0.25) {
          context.particleSystem.emit(
            s.targetPos,
            s.targetNormal,
            3,
            '#ff5500',
            0.5,
            1.8,
            0.4,
            0.2
          );
        }

        if (s.lingerTimer <= 0.7) {
          const fade = Math.max(0, s.lingerTimer / 0.7);
          s.group.scale.set(fade, fade, fade);
        }

        if (s.lingerTimer <= 0) {
          context.scene.remove(s.group);
          disposeNode(s.group);
          this.activeStomps.splice(i, 1);
        }
      }
    }
  }

  private onStomp(s: ActiveStomp, context: WeaponContext): void {
    context.planet.registerImpact({
      u: s.targetUV.u,
      v: s.targetUV.v,
      lat: s.targetLat,
      lon: s.targetLon,
      position: s.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.9,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(s.targetPos, s.targetNormal, context.planet.config.radius * 1.3, '#aa00ff');
    context.particleSystem.emit(s.targetPos, s.targetNormal, 100, '#ff3300', 2.5, 6.5, 2.0, 1.0);
    context.cameraController.addTrauma(0.85);
    context.audioManager.playTitanStomp();
  }

  public dispose(): void {
    for (const s of this.activeStomps) {
      disposeNode(s.group);
    }
    this.activeStomps = [];
  }
}
