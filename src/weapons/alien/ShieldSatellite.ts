import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveShieldSatellite {
  satelliteMesh: THREE.Group;
  orbitAngle: number;
  altitude: number;
}

export class ShieldSatelliteWeapon extends Weapon {
  private activeSatellites: ActiveShieldSatellite[] = [];

  constructor() {
    super({
      id: 'shield_satellite',
      name: 'Shield Satellite',
      category: 'alien',
      description: 'Deploys an orbital defense satellite generating a persistent forcefield protecting the planet.',
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

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const altitude = context.planet.config.radius + 1.8;
    const satPos = target.normal.clone().multiplyScalar(altitude);
    const satelliteMesh = this.createSatelliteMesh();
    satelliteMesh.position.copy(satPos);
    satelliteMesh.lookAt(new THREE.Vector3(0, 0, 0));
    context.scene.add(satelliteMesh);

    // Deploy the persistent planetary defense shield!
    context.planet.deployShield('hex_barrier');

    this.activeSatellites.push({
      satelliteMesh,
      orbitAngle: Math.atan2(target.normal.z, target.normal.x),
      altitude,
    });

    context.audioManager.playShieldDeflect();
  }

  public update(delta: number): void {
    for (const sat of this.activeSatellites) {
      sat.orbitAngle += delta * 0.2;
      sat.satelliteMesh.position.x = Math.cos(sat.orbitAngle) * sat.altitude;
      sat.satelliteMesh.position.z = Math.sin(sat.orbitAngle) * sat.altitude;
      sat.satelliteMesh.rotation.y += delta * 1.5;
    }
  }

  public dispose(): void {
    for (const s of this.activeSatellites) {
      disposeNode(s.satelliteMesh);
    }
    this.activeSatellites = [];
  }
}
