import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveUFO {
  group: THREE.Group;
  hull: THREE.Mesh;
  rimLights: THREE.Mesh[];
  beam: THREE.Mesh;
  hoverPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetPos: THREE.Vector3;
  timer: number;
  duration: number;
  laserCooldown: number;
}

export class AlienUFOWeapon extends Weapon {
  private activeUFOs: ActiveUFO[] = [];

  constructor() {
    super({
      id: 'alien_ufo',
      name: 'Alien UFO',
      category: 'alien',
      description: 'Flying saucer with rotating rim lights that warps in, hovers over the world, and fires rotating emerald death rays.',
      cooldownMs: 1500,
      iconName: 'Disc3',
      damageRadius: 0.08,
      damageIntensity: 0.9,
    });
  }

  private createUFOMesh(): { group: THREE.Group; hull: THREE.Mesh; rimLights: THREE.Mesh[]; beam: THREE.Mesh } {
    const group = new THREE.Group();

    // 1. Saucer main disc hull
    const discGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.08, 24);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x223344,
      metalness: 0.95,
      roughness: 0.15,
    });
    const hull = new THREE.Mesh(discGeo, discMat);
    group.add(hull);

    // 2. Upper cockpit dome
    const domeGeo = new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffaa,
      emissive: 0x00aa66,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.04;
    group.add(dome);

    // 3. Rotating rim lights (8 glowing orbs)
    const rimLights: THREE.Mesh[] = [];
    const lightGeo = new THREE.SphereGeometry(0.025, 8, 8);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42);
      hull.add(light);
      rimLights.push(light);
    }

    // 4. Emerald ventral death laser beam
    const beamGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.visible = false;
    group.add(beam);

    return { group, hull, rimLights, beam };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const hoverAltitude = context.planet.config.radius + 1.2;
    const hoverPos = target.normal.clone().multiplyScalar(hoverAltitude);

    const { group, hull, rimLights, beam } = this.createUFOMesh();
    group.position.copy(hoverPos);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.normal);
    context.scene.add(group);

    // Warp-in flash
    context.particleSystem.emit(hoverPos, target.normal, 25, '#00ffaa', 1.0, 2.5, 0.6, 0.4);

    this.activeUFOs.push({
      group,
      hull,
      rimLights,
      beam,
      hoverPos,
      targetNormal: target.normal.clone(),
      targetPos: target.point.clone(),
      timer: 0,
      duration: 3.5, // Hovers for 3.5 seconds
      laserCooldown: 0.1,
    });

    context.audioManager.playAlienUfoLaser();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeUFOs.length - 1; i >= 0; i--) {
      const ufo = this.activeUFOs[i];
      ufo.timer += delta;

      // Spin hull & cycle rim lights
      ufo.hull.rotation.y += delta * 5.0;
      ufo.laserCooldown -= delta;

      // Small hovering wobble
      const wobble = Math.sin(ufo.timer * 4.0) * 0.04;
      ufo.group.position.copy(ufo.hoverPos).addScaledVector(ufo.targetNormal, wobble);

      // Fire emerald death laser while active
      if (ufo.timer > 0.4 && ufo.timer < ufo.duration - 0.5) {
        // Spiral sweep around target location
        const sweepAngle = ufo.timer * 4.0;
        const sweepR = 0.25;
        const up = Math.abs(ufo.targetNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const tanU = new THREE.Vector3().crossVectors(ufo.targetNormal, up).normalize();
        const tanV = new THREE.Vector3().crossVectors(ufo.targetNormal, tanU).normalize();

        const currentGroundTarget = ufo.targetPos.clone()
          .addScaledVector(tanU, Math.cos(sweepAngle) * sweepR)
          .addScaledVector(tanV, Math.sin(sweepAngle) * sweepR)
          .normalize()
          .multiplyScalar(context.planet.config.radius);

        const beamDist = ufo.group.position.distanceTo(currentGroundTarget);
        const beamMid = ufo.group.position.clone().lerp(currentGroundTarget, 0.5);

        ufo.beam.visible = true;
        ufo.beam.position.copy(ufo.group.worldToLocal(beamMid));
        ufo.beam.scale.set(1, beamDist, 1);
        ufo.beam.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          currentGroundTarget.clone().sub(ufo.group.position).normalize()
        );

        if (ufo.laserCooldown <= 0) {
          ufo.laserCooldown = 0.08;

          const local = currentGroundTarget.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: currentGroundTarget,
            radius: 0.035,
            intensity: 0.6,
            heat: 0.9,
            timestamp: performance.now(),
            type: 'laser',
          });

          context.particleSystem.emit(currentGroundTarget, ufo.targetNormal, 4, '#00ff88', 0.3, 1.2, 0.2, 0.1);
          context.audioManager.playAlienUfoLaser();
        }
      } else {
        ufo.beam.visible = false;
      }

      // Warp out
      if (ufo.timer >= ufo.duration) {
        context.particleSystem.emit(ufo.group.position, ufo.targetNormal, 30, '#00ffaa', 1.2, 3.0, 0.8, 0.5);
        context.scene.remove(ufo.group);
        disposeNode(ufo.group);
        this.activeUFOs.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const u of this.activeUFOs) {
      disposeNode(u.group);
    }
    this.activeUFOs = [];
  }
}
