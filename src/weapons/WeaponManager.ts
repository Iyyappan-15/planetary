import * as THREE from 'three';
import { Weapon, WeaponContext } from './Weapon';
import { WeaponId, TargetInfo } from '../types/weapon';
import { vector3ToUV, vector3ToLatLon } from '../utils/math';

// Explosives
import { NuclearMissileWeapon } from './explosive/NuclearMissile';
import { ClusterMissilesWeapon } from './explosive/ClusterMissiles';
import { AntimatterBombWeapon } from './explosive/AntimatterBomb';
import { StealthBomberWeapon } from './explosive/StealthBomber';
import { DrillingTorpedoWeapon } from './explosive/DrillingTorpedo';
import { TectonicDisruptorWeapon } from './explosive/TectonicDisruptor';

// Lasers & Energy
import { ContinuousLaserWeapon } from './energy/ContinuousLaser';
import { FreezeRayWeapon } from './energy/FreezeRay';
import { PlasmaCannonWeapon } from './energy/PlasmaCannon';
import { LaserBladeWeapon } from './energy/LaserBlade';
import { LightningStormWeapon } from './energy/LightningStorm';
import { SolarMirrorWeapon } from './energy/SolarMirror';

// Celestial
import { MeteorShowerWeapon } from './kinetic/MeteorShower';
import { GiantAsteroidWeapon } from './kinetic/GiantAsteroid';
import { MoonfallWeapon } from './kinetic/Moonfall';
import { MiniBlackHoleWeapon } from './cosmic/MiniBlackHole';
import { SpaceTearWeapon } from './cosmic/SpaceTear';
import { SolarFlareWeapon } from './kinetic/SolarFlare';

// Alien Technology
import { AlienUFOWeapon } from './alien/AlienUFO';
import { PlanetDestroyerWeapon } from './alien/PlanetDestroyer';
import { ShieldSatelliteWeapon } from './alien/ShieldSatellite';
import { HarvesterProbeWeapon } from './alien/HarvesterProbe';
import { ShieldBusterWeapon } from './alien/ShieldBuster';
import { NaniteSwarmWeapon } from './alien/NaniteSwarm';
import { AntiGravityDisruptorWeapon } from './alien/AntiGravityDisruptor';
import { ChunkExtractorWeapon } from './alien/ChunkExtractor';

// Monsters & Titans
import { SpaceWormWeapon } from './monsters/SpaceWorm';
import { CelestialPunchWeapon } from './monsters/CelestialPunch';
import { AbyssalDevourerWeapon } from './monsters/AbyssalDevourer';
import { CosmicDragonWeapon } from './monsters/CosmicDragon';
import { CelestialSwordWeapon } from './monsters/CelestialSword';

import { disposeNode } from '../utils/disposal';

export class WeaponManager {
  private weapons: Map<WeaponId, Weapon> = new Map();
  public activeWeaponId: WeaponId | null = 'nuclear_missile';
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  // 3D Target reticle indicator on planet surface
  public targetMarker: THREE.Mesh;
  public currentTarget: TargetInfo | null = null;
  public isHoldingTrigger: boolean = false;

  constructor() {
    // 1. Initialize Solar Smash Weapons
    const nuclearMissile = new NuclearMissileWeapon();
    const clusterMissiles = new ClusterMissilesWeapon();
    const antimatterBomb = new AntimatterBombWeapon();
    const stealthBomber = new StealthBomberWeapon();
    const drillingTorpedo = new DrillingTorpedoWeapon();
    const tectonicDisruptor = new TectonicDisruptorWeapon();

    const continuousLaser = new ContinuousLaserWeapon();
    const freezeRay = new FreezeRayWeapon();
    const plasmaCannon = new PlasmaCannonWeapon();
    const laserBlade = new LaserBladeWeapon();
    const lightningStorm = new LightningStormWeapon();
    const solarMirror = new SolarMirrorWeapon();

    const meteorShower = new MeteorShowerWeapon();
    const giantAsteroid = new GiantAsteroidWeapon();
    const moonCollision = new MoonfallWeapon();
    const blackHole = new MiniBlackHoleWeapon();
    const spaceTear = new SpaceTearWeapon();
    const solarFlare = new SolarFlareWeapon();

    const alienUfo = new AlienUFOWeapon();
    const planetDestroyer = new PlanetDestroyerWeapon();
    const shieldSatellite = new ShieldSatelliteWeapon();
    const harvesterProbe = new HarvesterProbeWeapon();
    const shieldBuster = new ShieldBusterWeapon();
    const naniteSwarm = new NaniteSwarmWeapon();
    const antigravityDisruptor = new AntiGravityDisruptorWeapon();
    const chunkExtractor = new ChunkExtractorWeapon();

    const spaceWorm = new SpaceWormWeapon();
    const celestialPunch = new CelestialPunchWeapon();
    const abyssalDevourer = new AbyssalDevourerWeapon();
    const cosmicDragon = new CosmicDragonWeapon();
    const celestialSword = new CelestialSwordWeapon();

    // Register primary arsenal
    this.registerWeapon(nuclearMissile);
    this.registerWeapon(clusterMissiles);
    this.registerWeapon(antimatterBomb);
    this.registerWeapon(stealthBomber);
    this.registerWeapon(drillingTorpedo);
    this.registerWeapon(tectonicDisruptor);

    this.registerWeapon(continuousLaser);
    this.registerWeapon(freezeRay);
    this.registerWeapon(plasmaCannon);
    this.registerWeapon(laserBlade);
    this.registerWeapon(lightningStorm);
    this.registerWeapon(solarMirror);

    this.registerWeapon(meteorShower);
    this.registerWeapon(giantAsteroid);
    this.registerWeapon(moonCollision);
    this.registerWeapon(blackHole);
    this.registerWeapon(spaceTear);
    this.registerWeapon(solarFlare);

    this.registerWeapon(alienUfo);
    this.registerWeapon(planetDestroyer);
    this.registerWeapon(shieldSatellite);
    this.registerWeapon(harvesterProbe);
    this.registerWeapon(shieldBuster);
    this.registerWeapon(naniteSwarm);
    this.registerWeapon(antigravityDisruptor);
    this.registerWeapon(chunkExtractor);

    this.registerWeapon(spaceWorm);
    this.registerWeapon(celestialPunch);
    this.registerWeapon(abyssalDevourer);
    this.registerWeapon(cosmicDragon);
    this.registerWeapon(celestialSword);

    // Compatibility aliases
    this.weapons.set('meteor', meteorShower);
    this.weapons.set('orbital_laser', continuousLaser);
    this.weapons.set('nuclear_blast', nuclearMissile);
    this.weapons.set('moonfall', moonCollision);
    this.weapons.set('mini_black_hole', blackHole);
    this.weapons.set('plasma_beam', plasmaCannon);
    this.weapons.set('gravity_well', blackHole);
    this.weapons.set('planetary_glassmaker', continuousLaser);

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

  public getWeapon(id: WeaponId): Weapon | null {
    return this.weapons.get(id) || null;
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
      const uv = hit.uv ? { u: hit.uv.x, v: hit.uv.y } : vector3ToUV(localPoint);
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
