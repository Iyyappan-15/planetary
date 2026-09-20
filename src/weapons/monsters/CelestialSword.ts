import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveSword {
  group: THREE.Group;
  portalGroup: THREE.Group;
  bladeAura: THREE.Mesh;
  flightDir: THREE.Vector3; // Direction from entry through center to exit
  entryPos: THREE.Vector3;
  entryNormal: THREE.Vector3;
  entryUV: { u: number; v: number };
  entryLat: number;
  entryLon: number;
  exitPos: THREE.Vector3;
  exitNormal: THREE.Vector3;
  exitUV: { u: number; v: number };
  exitLat: number;
  exitLon: number;
  planetRadius: number;
  // Flight state
  timer: number;
  totalDuration: number;
  hasHitEntry: boolean;
  hasHitExit: boolean;
  pulseTimer: number;
}

export class CelestialSwordWeapon extends Weapon {
  private activeSwords: ActiveSword[] = [];

  constructor() {
    super({
      id: 'celestial_sword',
      name: 'Celestial Sword',
      category: 'monsters',
      description: 'Summons a colossal divine blade from deep space that plunges through the planetary crust, impales the core, and bursts out through the opposite hemisphere before ascending into starlight.',
      cooldownMs: 2500,
      iconName: 'Sword',
      damageRadius: 0.24,
      damageIntensity: 2.4,
    });
  }

  /**
   * Constructs the ethereal summoning portal in deep space where the sword originates.
   */
  private createPortalMesh(): THREE.Group {
    const group = new THREE.Group();

    const goldMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.8,
    });
    const cyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });

    // Outer runic ring
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.05, 12, 48), goldMat);
    group.add(outerRing);

    // Inner starlight ring
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.04, 12, 36), cyanMat);
    group.add(innerRing);

    // Starburst cross spokes
    const spokeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const spoke1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6.2, 8), spokeMat);
    group.add(spoke1);

    const spoke2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6.2, 8), spokeMat);
    spoke2.rotation.z = Math.PI / 2;
    group.add(spoke2);

    return group;
  }

  /**
   * Constructs the colossal divine greatsword model.
   * Forward axis is +Z:
   *   - Tip is at z = +6.2
   *   - Blade extends from z = 0 to z = +6.2
   *   - Crossguard is at z = 0
   *   - Hilt extends from z = 0 to z = -1.8
   *   - Pommel crystal is at z = -2.0
   * Total length = 8.2 units!
   */
  private createSwordMesh(): { group: THREE.Group; bladeAura: THREE.Mesh } {
    const group = new THREE.Group();

    // 1. Blade Core Material (Radiant Celestial Steel)
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f8ff,
      emissive: 0x44bbff,
      emissiveIntensity: 0.95,
      roughness: 0.08,
      metalness: 0.95,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.85,
    });

    // 2. Double-Edged Faceted Diamond Blade
    // Cylinder geometry aligned along Z axis (rotation.x = PI/2)
    const bladeGeo = new THREE.CylinderGeometry(0.06, 0.35, 6.2, 4);
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh.scale.set(0.35, 1, 1);
    bladeMesh.position.set(0, 0, 3.1);
    bladeMesh.rotation.x = Math.PI / 2;
    group.add(bladeMesh);

    // Glowing Ethereal Outer Aura Envelope
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const auraGeo = new THREE.CylinderGeometry(0.09, 0.42, 6.4, 4);
    const bladeAura = new THREE.Mesh(auraGeo, auraMat);
    bladeAura.scale.set(0.42, 1, 1.08);
    bladeAura.position.set(0, 0, 3.1);
    bladeAura.rotation.x = Math.PI / 2;
    group.add(bladeAura);

    // Central Glowing Fuller Spine
    const fullerGeo = new THREE.BoxGeometry(0.04, 0.08, 5.8);
    const fullerMat = new THREE.MeshBasicMaterial({ color: 0x99ffff });
    const fullerMesh = new THREE.Mesh(fullerGeo, fullerMat);
    fullerMesh.position.set(0, 0, 2.9);
    group.add(fullerMesh);

    // 3. Ornate Winged Angelic Crossguard
    const guardCentralGeo = new THREE.BoxGeometry(0.8, 0.35, 0.4);
    const guardCentral = new THREE.Mesh(guardCentralGeo, goldMat);
    guardCentral.position.set(0, 0, 0);
    group.add(guardCentral);

    // Swept Guard Wings
    const wingGeo = new THREE.CylinderGeometry(0.05, 0.22, 1.3, 5);
    const leftWing = new THREE.Mesh(wingGeo, goldMat);
    leftWing.position.set(-0.95, 0, 0.15);
    leftWing.rotation.z = Math.PI / 3;
    leftWing.rotation.x = Math.PI / 2;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, goldMat);
    rightWing.position.set(0.95, 0, 0.15);
    rightWing.rotation.z = -Math.PI / 3;
    rightWing.rotation.x = Math.PI / 2;
    group.add(rightWing);

    // Guard Center Sapphire Gem
    const gemGeo = new THREE.OctahedronGeometry(0.24);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0088ff,
      emissiveIntensity: 1.3,
      roughness: 0.1,
      metalness: 0.5,
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    gem.position.set(0, 0, 0);
    group.add(gem);

    // 4. Sacred Hilt Grip
    const gripGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.8, 16);
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.4,
      metalness: 0.6,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, 0, -0.9);
    grip.rotation.x = Math.PI / 2;
    group.add(grip);

    // Golden Rings on Grip
    for (let r = 0; r < 4; r++) {
      const ringGeo = new THREE.TorusGeometry(0.11, 0.02, 8, 16);
      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.position.set(0, 0, -0.4 - r * 0.35);
      group.add(ring);
    }

    // 5. Starlight Pommel Crystal
    const pommelGeo = new THREE.DodecahedronGeometry(0.28);
    const pommel = new THREE.Mesh(pommelGeo, goldMat);
    pommel.position.set(0, 0, -1.9);
    group.add(pommel);

    const pommelCoreGeo = new THREE.OctahedronGeometry(0.17);
    const pommelCore = new THREE.Mesh(pommelCoreGeo, gemMat);
    pommelCore.position.set(0, 0, -1.9);
    group.add(pommelCore);

    return { group, bladeAura };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const planetRadius = context.planet.config.radius;
    const entryPos = target.point.clone();
    const entryNormal = target.normal ? target.normal.clone() : entryPos.clone().normalize();

    // Flight direction points straight into the planet through the center towards the antipode
    const flightDir = entryNormal.clone().negate().normalize();

    // Antipodal Exit coordinates on the opposite side of the planet
    const exitPos = entryPos.clone().negate();
    const exitNormal = entryNormal.clone().negate();

    // Compute exact UV and lat/lon on the opposite side
    const exitLocal = exitPos.clone();
    context.planet.surfaceMesh.worldToLocal(exitLocal);
    const exitUV = vector3ToUV(exitLocal);
    const { lat: exitLat, lon: exitLon } = vector3ToLatLon(exitLocal);

    // Initial sword position far out in deep space along entry axis
    const spawnDist = planetRadius + 18.0;
    const portalPos = entryPos.clone().addScaledVector(entryNormal, 18.0);

    // Create portal at spawn location
    const portalGroup = this.createPortalMesh();
    portalGroup.position.copy(portalPos);
    portalGroup.lookAt(entryPos);
    context.scene.add(portalGroup);

    // Create the sword
    const { group, bladeAura } = this.createSwordMesh();
    // Align sword so that its local +Z (pointing toward tip) faces flightDir
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flightDir);

    // Place sword initially so its tip is at the portal
    // Since tip is at +6.2 along local Z, group origin is 6.2 units behind tip
    const initialGroupPos = portalPos.clone().addScaledVector(flightDir, -6.2);
    group.position.copy(initialGroupPos);
    context.scene.add(group);

    this.activeSwords.push({
      group,
      portalGroup,
      bladeAura,
      flightDir,
      entryPos,
      entryNormal,
      entryUV: { ...target.uv },
      entryLat: target.lat,
      entryLon: target.lon,
      exitPos,
      exitNormal,
      exitUV,
      exitLat,
      exitLon,
      planetRadius,
      timer: 0,
      totalDuration: 3.4,
      hasHitEntry: false,
      hasHitExit: false,
      pulseTimer: 0,
    });

    context.audioManager.playCelestialSword();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeSwords.length - 1; i >= 0; i--) {
      const s = this.activeSwords[i];
      s.timer += delta;
      const progress = Math.min(1.0, s.timer / s.totalDuration);

      // Rotate portal in space
      if (s.portalGroup) {
        s.portalGroup.rotation.z += delta * 2.5;
      }

      // Vibrate aura
      const vibe = Math.sin(s.timer * 35.0) * 0.02;
      s.bladeAura.scale.x = 0.42 + vibe * 2.0;
      s.bladeAura.scale.z = 1.08 + vibe * 2.0;

      // -------------------------------------------------------------
      // TRAJECTORY: Tip moves from (-R - 18.0) to (+R + 18.0) along flightDir
      // Where 0 is the center of the planet.
      // -R is the entry surface!
      // +R is the exit surface!
      // -------------------------------------------------------------
      const R = s.planetRadius;
      const startTipDist = -R - 18.0;
      const endTipDist = R + 18.0;

      // Smooth majestic motion: rapid plunge with smooth acceleration
      // Cubic easing for realistic gravitational acceleration
      const easeT = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentTipDist = startTipDist + (endTipDist - startTipDist) * easeT;

      // Group position is 6.2 units behind the tip
      const currentGroupDist = currentTipDist - 6.2;
      s.group.position.copy(s.flightDir).multiplyScalar(currentGroupDist);

      // Tip world position
      const tipPos = s.group.position.clone().addScaledVector(s.flightDir, 6.2);
      // Pommel world position
      const pommelPos = s.group.position.clone().addScaledVector(s.flightDir, -2.0);

      // Trailing stardust wake behind the sword
      context.particleSystem.emit(
        pommelPos,
        s.flightDir.clone().negate(),
        4,
        '#00f0ff',
        0.8,
        2.5,
        0.4,
        0.2
      );

      // -------------------------------------------------------------
      // EVENT 1: TIP PIERCES ENTRY SURFACE (currentTipDist >= -R)
      // -------------------------------------------------------------
      if (!s.hasHitEntry && currentTipDist >= -R) {
        s.hasHitEntry = true;
        this.triggerEntryImpact(s, context);
      }

      // -------------------------------------------------------------
      // WHILE SWORD IS PASSING THROUGH PLANET (Between Entry & Exit)
      // -------------------------------------------------------------
      if (s.hasHitEntry && currentGroupDist < R) {
        // Continuous lava & holy plasma eruption from entry crater
        if (Math.random() < 0.5) {
          context.particleSystem.emit(
            s.entryPos,
            s.entryNormal,
            3,
            '#ff6600',
            1.2,
            3.2,
            0.5,
            0.3
          );
          context.particleSystem.emit(
            s.entryPos,
            s.entryNormal,
            3,
            '#00ffff',
            1.0,
            2.8,
            0.4,
            0.2
          );
        }

        // Tectonic pulse while cutting through mantle
        s.pulseTimer += delta;
        if (s.pulseTimer >= 0.25) {
          s.pulseTimer = 0;
          context.cameraController.addTrauma(0.18);
        }
      }

      // -------------------------------------------------------------
      // EVENT 2: TIP BREAKS OUT OF OPPOSITE SIDE (currentTipDist >= +R)
      // -------------------------------------------------------------
      if (!s.hasHitExit && currentTipDist >= R) {
        s.hasHitExit = true;
        this.triggerExitImpact(s, context);
      }

      // While sword is emerging from exit side
      if (s.hasHitExit && progress < 0.85) {
        // Magma plume spraying out of the exit blowout
        if (Math.random() < 0.6) {
          context.particleSystem.emit(
            s.exitPos,
            s.exitNormal,
            4,
            '#00ffff',
            1.5,
            3.8,
            0.6,
            0.3
          );
          context.particleSystem.emit(
            s.exitPos,
            s.exitNormal,
            3,
            '#ff3300',
            1.2,
            3.0,
            0.5,
            0.2
          );
        }
      }

      // -------------------------------------------------------------
      // FINAL FADE & ASCENSION INTO DEEP SPACE
      // -------------------------------------------------------------
      // Portal fades out after sword has entered
      if (progress > 0.35 && s.portalGroup) {
        const portalFade = Math.max(0, 1.0 - (progress - 0.35) / 0.25);
        s.portalGroup.scale.set(portalFade, portalFade, portalFade);
      }

      // Sword dissolves in final stretch into starlight
      if (progress > 0.8) {
        const fade = Math.max(0, (1.0 - progress) / 0.2);
        s.group.scale.set(fade, fade, fade);

        // Ascending starlight sparkles
        context.particleSystem.emit(
          tipPos,
          s.flightDir,
          5,
          '#aaccff',
          1.5,
          4.0,
          0.8,
          0.4
        );
      }

      // Completion & disposal
      if (progress >= 1.0) {
        context.scene.remove(s.group);
        context.scene.remove(s.portalGroup);
        disposeNode(s.group);
        disposeNode(s.portalGroup);
        this.activeSwords.splice(i, 1);
      }
    }
  }

  /**
   * Cataclysmic entry impact on the targeted hemisphere.
   */
  private triggerEntryImpact(s: ActiveSword, context: WeaponContext): void {
    // 1. Crater & fracture on entry side
    context.planet.registerImpact({
      u: s.entryUV.u,
      v: s.entryUV.v,
      lat: s.entryLat,
      lon: s.entryLon,
      position: s.entryPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    const R = s.planetRadius;

    // 2. Multi-tier entry shockwaves
    context.shockwaveSystem.create(s.entryPos, s.entryNormal, R * 1.2, '#ffffff');
    context.shockwaveSystem.create(s.entryPos, s.entryNormal, R * 1.6, '#00f0ff');
    context.shockwaveSystem.create(s.entryPos, s.entryNormal, R * 0.8, '#ff9900');

    // 3. Entry ejecta spray backwards into space
    context.particleSystem.emit(s.entryPos, s.entryNormal, 90, '#00ffff', 2.8, 6.5, 2.0, 1.0);
    context.particleSystem.emit(s.entryPos, s.entryNormal, 60, '#ffffff', 2.2, 5.0, 1.5, 0.8);
    context.particleSystem.emit(s.entryPos, s.entryNormal, 50, '#ff6600', 1.8, 4.5, 1.4, 0.7);

    // 4. Camera trauma & impact audio
    context.cameraController.addTrauma(0.85);
    context.audioManager.playCelestialSword();
  }

  /**
   * Cataclysmic breakthrough blowout on the OPPOSITE hemisphere.
   */
  private triggerExitImpact(s: ActiveSword, context: WeaponContext): void {
    // 1. Crater & fracture on exit side
    context.planet.registerImpact({
      u: s.exitUV.u,
      v: s.exitUV.v,
      lat: s.exitLat,
      lon: s.exitLon,
      position: s.exitPos,
      radius: this.config.damageRadius * 0.9,
      intensity: this.config.damageIntensity * 0.85,
      heat: 1.0,
      timestamp: performance.now(),
    });

    const R = s.planetRadius;

    // 2. Violent exit shockwaves bursting outward
    context.shockwaveSystem.create(s.exitPos, s.exitNormal, R * 1.4, '#00ffff');
    context.shockwaveSystem.create(s.exitPos, s.exitNormal, R * 0.9, '#ff3300');
    context.shockwaveSystem.create(s.exitPos, s.exitNormal, R * 0.5, '#ffffff');

    // 3. Massive blowout geyser into space
    context.particleSystem.emit(s.exitPos, s.exitNormal, 100, '#00ffff', 3.2, 7.5, 2.2, 1.2);
    context.particleSystem.emit(s.exitPos, s.exitNormal, 70, '#ff3300', 2.5, 6.0, 1.8, 0.9);
    context.particleSystem.emit(s.exitPos, s.exitNormal, 50, '#ffd700', 2.0, 5.0, 1.5, 0.7);

    // 4. Secondary camera trauma & sound
    context.cameraController.addTrauma(0.9);
    context.audioManager.playCelestialSword();
  }

  public dispose(): void {
    for (const s of this.activeSwords) {
      disposeNode(s.group);
      disposeNode(s.portalGroup);
    }
    this.activeSwords = [];
  }
}
