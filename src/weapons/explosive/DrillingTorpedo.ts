import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveDrill {
  group: THREE.Group;
  drillBit: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
  state: 'falling' | 'drilling';
  drillTimer: number;
}

export class DrillingTorpedoWeapon extends Weapon {
  private activeDrills: ActiveDrill[] = [];

  constructor() {
    super({
      id: 'drilling_torpedo',
      name: 'Drilling Torpedo',
      category: 'explosives',
      description: 'Heavy penetrator that drills into the crust before detonating an underground magma eruption.',
      cooldownMs: 1100,
      iconName: 'Anchor',
      keyShortcut: '5',
      damageRadius: 0.09,
      damageIntensity: 1.1,
    });
  }

  private createDrillMesh(): { group: THREE.Group; drillBit: THREE.Mesh } {
    const group = new THREE.Group();

    // Heavy torpedo body
    const bodyGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.5, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x333b44,
      metalness: 0.9,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // Fluted helical drill bit
    const bitGeo = new THREE.ConeGeometry(0.045, 0.22, 6);
    const bitMat = new THREE.MeshStandardMaterial({
      color: 0xffaa22,
      emissive: 0x773300,
      metalness: 0.95,
      roughness: 0.1,
    });
    const drillBit = new THREE.Mesh(bitGeo, bitMat);
    drillBit.rotation.x = -Math.PI / 2;
    drillBit.position.z = 0.32;
    group.add(drillBit);

    return { group, drillBit };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 7.0);
    const { group, drillBit } = this.createDrillMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activeDrills.push({
      group,
      drillBit,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
      state: 'falling',
      drillTimer: 0.6,
    });

    context.audioManager.playMissileLaunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeDrills.length - 1; i >= 0; i--) {
      const drill = this.activeDrills[i];

      if (drill.state === 'falling') {
        drill.progress += delta * 3.2;
        drill.group.position.lerpVectors(drill.startPos, drill.targetPos, drill.progress);

        if (drill.progress >= 1.0) {
          drill.state = 'drilling';
          drill.group.position.copy(drill.targetPos);
        }
      } else if (drill.state === 'drilling') {
        drill.drillTimer -= delta;

        // Rapid spin & penetrate into ground
        drill.drillBit.rotation.y += delta * 45.0;
        drill.group.position.addScaledVector(drill.targetNormal, -delta * 0.12);

        // Drilling sparks & rock fragments
        context.particleSystem.emit(
          drill.targetPos,
          drill.targetNormal,
          4,
          '#ffaa00',
          0.3,
          1.2,
          0.2,
          0.1
        );

        if (drill.drillTimer <= 0) {
          this.onDetonate(drill, context);
          context.scene.remove(drill.group);
          disposeNode(drill.group);
          this.activeDrills.splice(i, 1);
        }
      }
    }
  }

  private onDetonate(drill: ActiveDrill, context: WeaponContext): void {
    context.planet.registerImpact({
      u: drill.targetUV.u,
      v: drill.targetUV.v,
      lat: drill.targetLat,
      lon: drill.targetLon,
      position: drill.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.95,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(drill.targetPos, drill.targetNormal, context.planet.config.radius * 0.45, '#ff6600');
    // Subterranean magma blowout
    context.particleSystem.emit(drill.targetPos, drill.targetNormal, 60, '#ff3300', 1.6, 4.2, 1.2, 0.8);

    context.cameraController.addTrauma(0.35);
    context.audioManager.playNuclearDetonation();
  }

  public dispose(): void {
    for (const d of this.activeDrills) {
      disposeNode(d.group);
    }
    this.activeDrills = [];
  }
}
