import * as THREE from 'three';
import { Weapon, WeaponContext } from './Weapon';
import { WeaponId, TargetInfo } from '../types/weapon';
import { vector3ToUV, vector3ToLatLon } from '../utils/math';
import { MeteorWeapon } from './kinetic/Meteor';
import { OrbitalLaserWeapon } from './energy/OrbitalLaser';
import { NuclearBlastWeapon } from './explosive/NuclearBlast';
import { GravityWellWeapon } from './gravity/GravityWell';
import { GiantAsteroidWeapon } from './kinetic/GiantAsteroid';
import { PlasmaBeamWeapon } from './energy/PlasmaBeam';
import { MiniBlackHoleWeapon } from './cosmic/MiniBlackHole';
import { SpaceTearWeapon } from './cosmic/SpaceTear';
import { GlassmakerWeapon } from './energy/Glassmaker';
import { MoonfallWeapon } from './kinetic/Moonfall';
import { disposeNode } from '../utils/disposal';

export class WeaponManager {
  private weapons: Map<WeaponId, Weapon> = new Map();
  public activeWeaponId: WeaponId | null = 'meteor';
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  // 3D Target reticle indicator on planet surface
  public targetMarker: THREE.Mesh;
  public currentTarget: TargetInfo | null = null;
  public isHoldingTrigger: boolean = false;

  constructor() {
    // 1. Initialize Weapons
    this.registerWeapon(new MeteorWeapon());
    this.registerWeapon(new OrbitalLaserWeapon());
    this.registerWeapon(new NuclearBlastWeapon());
    this.registerWeapon(new GravityWellWeapon());
    this.registerWeapon(new GiantAsteroidWeapon());
    this.registerWeapon(new PlasmaBeamWeapon());
    this.registerWeapon(new MiniBlackHoleWeapon());
    this.registerWeapon(new SpaceTearWeapon());
    this.registerWeapon(new GlassmakerWeapon());
    this.registerWeapon(new MoonfallWeapon());

    // 2. Build 3D targeting reticle (depthTest: false prevents clipping into planet mesh)
    const markerGeo = new THREE.RingGeometry(0.06, 0.09, 32);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.targetMarker = new THREE.Mesh(markerGeo, markerMat);
    this.targetMarker.renderOrder = 999;
    this.targetMarker.visible = false;
  }

  private registerWeapon(weapon: Weapon): void {
    this.weapons.set(weapon.config.id, weapon);
  }

  public getActiveWeapon(): Weapon | null {
    if (!this.activeWeaponId) return null;
    return this.weapons.get(this.activeWeaponId) || null;
  }

  public setActiveWeapon(id: WeaponId | null, context: WeaponContext): void {
    if (this.activeWeaponId !== id) {
      if (this.activeWeaponId) {
        this.weapons.get(this.activeWeaponId)?.stopContinuous(context);
      }
      this.activeWeaponId = id;
    }
  }

  /**
   * Performs raycasting against the planet mesh
   */
  public updateTargeting(
    clientX: number,
    clientY: number,
    width: number,
    height: number,
    camera: THREE.Camera,
    context: WeaponContext
  ): TargetInfo | null {
    this.mouseVec.x = (clientX / width) * 2 - 1;
    this.mouseVec.y = -(clientY / height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, camera);

    if (context.planet.isDestroyed) {
      this.targetMarker.visible = false;
      this.currentTarget = null;
      return null;
    }

    const intersects = this.raycaster.intersectObject(context.planet.surfaceMesh, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point.clone();
      const normal = hit.normal ? hit.normal.clone() : point.clone().normalize();

      // Compute UV in local planet space (accounting for planet rotation)
      const localPoint = point.clone();
      context.planet.surfaceMesh.worldToLocal(localPoint);
      const uv = vector3ToUV(localPoint);
      const { lat, lon } = vector3ToLatLon(localPoint);

      this.currentTarget = {
        point,
        normal,
        uv,
        lat,
        lon,
        distance: hit.distance,
      };

      // Position reticle just above the surface aligned with surface normal if a weapon is selected
      if (this.activeWeaponId) {
        this.targetMarker.visible = true;
        this.targetMarker.position.copy(point).addScaledVector(normal, 0.02);
        this.targetMarker.lookAt(point.clone().add(normal));

        // Pulse reticle
        const s = 1.0 + Math.sin(performance.now() * 0.008) * 0.15;
        this.targetMarker.scale.set(s, s, s);
      } else {
        this.targetMarker.visible = false;
      }

      return this.currentTarget;
    } else {
      this.targetMarker.visible = false;
      this.currentTarget = null;
      return null;
    }
  }

  public fire(context: WeaponContext): boolean {
    if (!this.currentTarget || context.planet.isDestroyed) return false;

    const weapon = this.getActiveWeapon();
    if (weapon && weapon.canFire()) {
      weapon.execute(this.currentTarget, context);
      return true;
    }
    return false;
  }

  public startContinuous(context: WeaponContext): void {
    this.isHoldingTrigger = true;
    if (this.currentTarget) {
      this.fire(context);
    }
  }

  public stopContinuous(context: WeaponContext): void {
    this.isHoldingTrigger = false;
    this.getActiveWeapon()?.stopContinuous(context);
  }

  public update(delta: number, context: WeaponContext): void {
    const active = this.getActiveWeapon();

    // If holding down trigger on a weapon that requires hold or can rapid fire
    if (active && this.isHoldingTrigger && this.currentTarget && !context.planet.isDestroyed) {
      if (active.config.requiresHold) {
        active.execute(this.currentTarget, context);
      } else if (active.canFire()) {
        active.execute(this.currentTarget, context);
      }
    }

    // Update all weapons
    for (const weapon of this.weapons.values()) {
      weapon.update(delta, context);
    }
  }

  public dispose(): void {
    for (const weapon of this.weapons.values()) {
      weapon.dispose();
    }
    this.weapons.clear();
    disposeNode(this.targetMarker);
  }
}
