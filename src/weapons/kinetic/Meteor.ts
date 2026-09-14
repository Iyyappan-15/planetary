import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveMeteor {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
  speed: number;
}

export class MeteorWeapon extends Weapon {
  private activeMeteors: ActiveMeteor[] = [];
  private meteorGeo: THREE.DodecahedronGeometry;
  private meteorMat: THREE.MeshStandardMaterial;

  constructor() {
    super({
      id: 'meteor',
      name: 'Meteor',
      category: 'kinetic',
      description: 'Dense hyper-velocity orbital rock that enters the atmosphere and punches a fiery impact crater into the crust.',
      cooldownMs: 350,
      iconName: 'Flame',
      keyShortcut: '1',
      damageRadius: 0.045,
      damageIntensity: 0.8,
    });

    this.meteorGeo = new THREE.DodecahedronGeometry(0.18, 1);
    this.meteorMat = new THREE.MeshStandardMaterial({
      color: 0x332211,
      roughness: 0.9,
      metalness: 0.1,
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // Spawn 8 units outward along the surface normal
    const startPos = target.point.clone().addScaledVector(target.normal, 8.0);
    // Add slight trajectory angle
    startPos.x += (Math.random() - 0.5) * 2.0;
    startPos.y += (Math.random() - 0.5) * 2.0;

    const mesh = new THREE.Mesh(this.meteorGeo, this.meteorMat.clone());
    mesh.position.copy(startPos);
    mesh.lookAt(target.point);
    context.scene.add(mesh);

    this.activeMeteors.push({
      mesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
      speed: 4.2, // Time to impact ~ 0.25s
    });
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
      const meteor = this.activeMeteors[i];
      meteor.progress += meteor.speed * delta;

      if (meteor.progress >= 1.0) {
        // Impact reached!
        this.onImpact(meteor, context);
        context.scene.remove(meteor.mesh);
        disposeNode(meteor.mesh);
        this.activeMeteors.splice(i, 1);
        continue;
      }

      // Move toward target
      meteor.mesh.position.lerpVectors(meteor.startPos, meteor.targetPos, meteor.progress);
      meteor.mesh.rotation.x += delta * 6.0;
      meteor.mesh.rotation.y += delta * 8.0;

      // Atmospheric ionization trail
      context.particleSystem.emit(
        meteor.mesh.position,
        meteor.targetNormal,
        2,
        '#ffaa22',
        0.2,
        0.8,
        0.3,
        0.2
      );
    }
  }

  private onImpact(meteor: ActiveMeteor, context: WeaponContext): void {
    // 1. Register damage & crater
    context.planet.registerImpact({
      u: meteor.targetUV.u,
      v: meteor.targetUV.v,
      lat: meteor.targetLat,
      lon: meteor.targetLon,
      position: meteor.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.75,
      timestamp: performance.now(),
    });

    // 2. Shockwave ring
    context.shockwaveSystem.create(
      meteor.targetPos,
      meteor.targetNormal,
      context.planet.config.radius * 0.45,
      '#ff8822'
    );

    // 3. Ejecta particle blast
    context.particleSystem.emit(
      meteor.targetPos,
      meteor.targetNormal,
      60,
      '#ff5500',
      1.5,
      4.8,
      1.4,
      0.85
    );

    // 4. Camera trauma & Audio
    context.cameraController.addTrauma(0.32);
    context.audioManager.playMeteorImpact();
  }

  public dispose(): void {
    for (const meteor of this.activeMeteors) {
      disposeNode(meteor.mesh);
    }
    this.activeMeteors = [];
    this.meteorGeo.dispose();
    this.meteorMat.dispose();
  }
}
