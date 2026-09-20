import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveSword {
  group: THREE.Group;
  mandalaGroup: THREE.Group;
  lightBeam: THREE.Mesh;
  bladeMesh: THREE.Mesh;
  bladeAura: THREE.Mesh;
  fullerMesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  // Phase management
  phase: 'summoning' | 'plunging' | 'impaled' | 'ascending';
  phaseTimer: number;
  pulseTimer: number;
}

export class CelestialSwordWeapon extends Weapon {
  private activeSwords: ActiveSword[] = [];

  constructor() {
    super({
      id: 'celestial_sword',
      name: 'Celestial Sword',
      category: 'monsters',
      description: 'Summons an ancient divine blade from a celestial constellation portal in deep space to pierce the planetary mantle and shatter the tectonic plates.',
      cooldownMs: 2500,
      iconName: 'Sword',
      damageRadius: 0.22,
      damageIntensity: 2.2,
    });
  }

  /**
   * Constructs the rotating celestial summoning mandala in orbit.
   */
  private createMandalaMesh(): THREE.Group {
    const group = new THREE.Group();

    // Outer golden runic torus
    const goldMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      wireframe: false,
      transparent: true,
      opacity: 0.85,
    });
    const outerRingGeo = new THREE.TorusGeometry(2.6, 0.05, 12, 64);
    const outerRing = new THREE.Mesh(outerRingGeo, goldMat);
    group.add(outerRing);

    // Secondary concentric cyan ring
    const cyanMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
    const innerRingGeo = new THREE.TorusGeometry(1.8, 0.03, 12, 48);
    const innerRing = new THREE.Mesh(innerRingGeo, cyanMat);
    group.add(innerRing);

    // Third fine starlight ring
    const starRingGeo = new THREE.TorusGeometry(1.1, 0.02, 12, 32);
    const starRing = new THREE.Mesh(starRingGeo, cyanMat);
    group.add(starRing);

    // Cross starburst beams
    const spokeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });
    const spokeGeo1 = new THREE.CylinderGeometry(0.025, 0.025, 5.4, 8);
    const spoke1 = new THREE.Mesh(spokeGeo1, spokeMat);
    group.add(spoke1);

    const spokeGeo2 = new THREE.CylinderGeometry(0.025, 0.025, 5.4, 8);
    const spoke2 = new THREE.Mesh(spokeGeo2, spokeMat);
    spoke2.rotation.z = Math.PI / 2;
    group.add(spoke2);

    // Diagonal glyph spokes
    const spokeGeo3 = new THREE.CylinderGeometry(0.015, 0.015, 4.0, 8);
    const spoke3 = new THREE.Mesh(spokeGeo3, goldMat);
    spoke3.rotation.z = Math.PI / 4;
    group.add(spoke3);

    const spokeGeo4 = new THREE.CylinderGeometry(0.015, 0.015, 4.0, 8);
    const spoke4 = new THREE.Mesh(spokeGeo4, goldMat);
    spoke4.rotation.z = -Math.PI / 4;
    group.add(spoke4);

    return group;
  }

  /**
   * Constructs the colossal divine greatsword mesh.
   */
  private createSwordMesh(): {
    group: THREE.Group;
    bladeMesh: THREE.Mesh;
    bladeAura: THREE.Mesh;
    fullerMesh: THREE.Mesh;
  } {
    const group = new THREE.Group();

    // 1. Blade Core Material (Radiant Celestial Steel)
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f8ff,
      emissive: 0x55ccff,
      emissiveIntensity: 0.9,
      roughness: 0.08,
      metalness: 0.95,
    });

    // 2. Gold Ornamentation Material
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.85,
    });

    // 3. Blade Diamond Cross-Section (length 6.2)
    const bladeGeo = new THREE.CylinderGeometry(0.05, 0.32, 6.2, 4);
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh.scale.set(0.35, 1, 1);
    bladeMesh.position.set(0, 0, 3.1);
    bladeMesh.rotation.x = Math.PI / 2;
    group.add(bladeMesh);

    // Ethereal Outer Aura Envelope
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const auraGeo = new THREE.CylinderGeometry(0.08, 0.4, 6.4, 4);
    const bladeAura = new THREE.Mesh(auraGeo, auraMat);
    bladeAura.scale.set(0.42, 1, 1.08);
    bladeAura.position.set(0, 0, 3.1);
    bladeAura.rotation.x = Math.PI / 2;
    group.add(bladeAura);

    // Glowing Central Fuller Channel
    const fullerGeo = new THREE.BoxGeometry(0.03, 0.06, 5.6);
    const fullerMat = new THREE.MeshBasicMaterial({
      color: 0x88ffff,
    });
    const fullerMesh = new THREE.Mesh(fullerGeo, fullerMat);
    fullerMesh.position.set(0, 0, 2.8);
    group.add(fullerMesh);

    // 4. Angelic Wing Crossguard
    const guardCentralGeo = new THREE.BoxGeometry(0.7, 0.3, 0.35);
    const guardCentral = new THREE.Mesh(guardCentralGeo, goldMat);
    guardCentral.position.set(0, 0, 0);
    group.add(guardCentral);

    // Left & Right Swept Wings
    const wingGeo = new THREE.CylinderGeometry(0.04, 0.2, 1.2, 5);
    const leftWing = new THREE.Mesh(wingGeo, goldMat);
    leftWing.position.set(-0.85, 0, 0.15);
    leftWing.rotation.z = Math.PI / 3;
    leftWing.rotation.x = Math.PI / 2;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, goldMat);
    rightWing.position.set(0.85, 0, 0.15);
    rightWing.rotation.z = -Math.PI / 3;
    rightWing.rotation.x = Math.PI / 2;
    group.add(rightWing);

    // Central Core Crest Sapphire Gem
    const gemGeo = new THREE.OctahedronGeometry(0.22);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0088ff,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.5,
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    gem.position.set(0, 0, 0);
    group.add(gem);

    // 5. Long Sacred Grip / Hilt
    const gripGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.4, 16);
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.4,
      metalness: 0.6,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, 0, -0.7);
    grip.rotation.x = Math.PI / 2;
    group.add(grip);

    // Golden Rings on Grip
    for (let r = 0; r < 4; r++) {
      const ringGeo = new THREE.TorusGeometry(0.105, 0.02, 8, 16);
      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.position.set(0, 0, -0.35 - r * 0.25);
      group.add(ring);
    }

    // 6. Radiant Multifaceted Pommel Crystal
    const pommelGeo = new THREE.DodecahedronGeometry(0.26);
    const pommel = new THREE.Mesh(pommelGeo, goldMat);
    pommel.position.set(0, 0, -1.5);
    group.add(pommel);

    const pommelCoreGeo = new THREE.OctahedronGeometry(0.15);
    const pommelCore = new THREE.Mesh(pommelCoreGeo, gemMat);
    pommelCore.position.set(0, 0, -1.5);
    group.add(pommelCore);

    return { group, bladeMesh, bladeAura, fullerMesh };
  }

  /**
   * Creates the vertical beam of divine starlight targeting the impact zone.
   */
  private createLightBeam(): THREE.Mesh {
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.5, 16, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.x = Math.PI / 2;
    return beam;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // Spawn high in orbit ~15.0 units out along normal
    const startPos = target.point.clone().addScaledVector(target.normal, 14.5);

    // 1. Mandala
    const mandalaGroup = this.createMandalaMesh();
    mandalaGroup.position.copy(startPos);
    mandalaGroup.lookAt(target.point);
    mandalaGroup.scale.set(0.01, 0.01, 0.01);
    context.scene.add(mandalaGroup);

    // 2. Light Beam
    const lightBeam = this.createLightBeam();
    const midPoint = target.point.clone().addScaledVector(target.normal, 7.25);
    lightBeam.position.copy(midPoint);
    lightBeam.lookAt(target.point);
    lightBeam.scale.set(0.01, 1, 0.01);
    context.scene.add(lightBeam);

    // 3. Sword Mesh
    const { group, bladeMesh, bladeAura, fullerMesh } = this.createSwordMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    // Initially sword is submerged halfway inside the portal
    group.scale.set(0.01, 0.01, 0.01);
    context.scene.add(group);

    this.activeSwords.push({
      group,
      mandalaGroup,
      lightBeam,
      bladeMesh,
      bladeAura,
      fullerMesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      phase: 'summoning',
      phaseTimer: 0,
      pulseTimer: 0,
    });

    context.audioManager.playCelestialSword();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeSwords.length - 1; i >= 0; i--) {
      const s = this.activeSwords[i];
      s.phaseTimer += delta;

      // Mandala orbital spin
      if (s.mandalaGroup) {
        s.mandalaGroup.rotation.z += delta * 2.2;
      }

      // ==========================================
      // PHASE 1: SUMMONING (Portal opens, blade manifests)
      // ==========================================
      if (s.phase === 'summoning') {
        const summonT = Math.min(1.0, s.phaseTimer / 0.9);
        const easeOut = Math.sin((summonT * Math.PI) / 2);

        // Expand mandala
        s.mandalaGroup.scale.set(easeOut, easeOut, easeOut);

        // Expand targeting light beam
        s.lightBeam.scale.set(easeOut * 1.2, 1, easeOut * 1.2);

        // Sword emerges out of portal
        s.group.scale.set(easeOut, easeOut, easeOut);

        // Holy starlight particles swirling around the portal
        if (Math.random() < 0.65) {
          context.particleSystem.emit(
            s.startPos,
            s.targetNormal,
            3,
            '#00ffff',
            1.2,
            3.0,
            0.6,
            0.4
          );
        }

        if (summonT >= 1.0) {
          s.phase = 'plunging';
          s.phaseTimer = 0;
        }
      }

      // ==========================================
      // PHASE 2: PLUNGING (Extreme acceleration plunge)
      // ==========================================
      else if (s.phase === 'plunging') {
        // High-velocity plunge in 0.65 seconds
        const plungeT = Math.min(1.0, s.phaseTimer / 0.65);
        // Exponential gravity dive
        const diveEase = Math.pow(plungeT, 3.2);

        s.group.position.lerpVectors(s.startPos, s.targetPos, diveEase);

        // Trailing sonic stardust ribbons
        context.particleSystem.emit(
          s.group.position,
          s.targetNormal,
          6,
          '#ffffff',
          0.8,
          2.5,
          0.4,
          0.2
        );
        context.particleSystem.emit(
          s.group.position,
          s.targetNormal,
          4,
          '#00ffff',
          0.6,
          2.0,
          0.3,
          0.2
        );

        if (plungeT >= 1.0) {
          s.phase = 'impaled';
          s.phaseTimer = 0;
          // Sink blade 2.1 units deep into crust and mantle
          s.group.position.copy(s.targetPos).addScaledVector(s.targetNormal, -2.1);
          this.triggerImpactCataclysm(s, context);
        }
      }

      // ==========================================
      // PHASE 3: IMPALED (Core detonation & tectonic pulse)
      // ==========================================
      else if (s.phase === 'impaled') {
        s.pulseTimer += delta;

        // Vibrating divine blade resonance
        const vibe = Math.sin(s.phaseTimer * 30.0) * 0.02;
        s.bladeAura.scale.x = 0.42 + vibe * 2.0;
        s.bladeAura.scale.z = 1.08 + vibe * 2.0;

        // Continuous planetary geyser of holy plasma and molten crust
        if (Math.random() < 0.45) {
          context.particleSystem.emit(
            s.targetPos,
            s.targetNormal,
            4,
            '#00ffff',
            1.5,
            3.5,
            0.6,
            0.3
          );
          context.particleSystem.emit(
            s.targetPos,
            s.targetNormal,
            3,
            '#ff8800',
            1.2,
            3.0,
            0.5,
            0.2
          );
        }

        // Resonant tectonic pulse every 0.45 seconds
        if (s.pulseTimer >= 0.45) {
          s.pulseTimer = 0;
          this.triggerResonantPulse(s, context);
        }

        // After 2.4 seconds of impalement, transition to ascending phase
        if (s.phaseTimer >= 2.4) {
          s.phase = 'ascending';
          s.phaseTimer = 0;
        }
      }

      // ==========================================
      // PHASE 4: ASCENDING (Dissolution into starlight)
      // ==========================================
      else if (s.phase === 'ascending') {
        const fadeT = Math.min(1.0, s.phaseTimer / 1.0);
        const invFade = 1.0 - fadeT;

        // Scale down sword as it dissolves into ascending particles
        s.group.scale.set(invFade, invFade, invFade);
        s.mandalaGroup.scale.set(invFade, invFade, invFade);
        s.lightBeam.scale.set(invFade * 1.2, 1, invFade * 1.2);

        // Rising starlight particles ascending into heavens
        context.particleSystem.emit(
          s.targetPos,
          s.targetNormal,
          5,
          '#aaccff',
          1.8,
          4.5,
          0.8,
          0.4
        );

        if (fadeT >= 1.0) {
          context.scene.remove(s.group);
          context.scene.remove(s.mandalaGroup);
          context.scene.remove(s.lightBeam);
          disposeNode(s.group);
          disposeNode(s.mandalaGroup);
          disposeNode(s.lightBeam);
          this.activeSwords.splice(i, 1);
        }
      }
    }
  }

  /**
   * Cataclysmic initial impalement impact: massive craters, triple shockwaves, and sound.
   */
  private triggerImpactCataclysm(s: ActiveSword, context: WeaponContext): void {
    // 1. Register planetary crater & heat signature
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

    const planetRadius = context.planet.config.radius;

    // 2. Multi-tier Divine Shockwaves
    // Core instantaneous flash wave
    context.shockwaveSystem.create(s.targetPos, s.targetNormal, planetRadius * 1.3, '#ffffff');
    // Massive celestial turquoise shockwave
    context.shockwaveSystem.create(s.targetPos, s.targetNormal, planetRadius * 1.8, '#00f0ff');
    // Slower golden tectonic boundary shockwave
    context.shockwaveSystem.create(s.targetPos, s.targetNormal, planetRadius * 0.9, '#ffcc00');

    // 3. Colossal explosion ejecta
    context.particleSystem.emit(s.targetPos, s.targetNormal, 110, '#00ffff', 3.0, 7.5, 2.2, 1.1);
    context.particleSystem.emit(s.targetPos, s.targetNormal, 80, '#ffffff', 2.5, 6.0, 1.8, 0.9);
    context.particleSystem.emit(s.targetPos, s.targetNormal, 70, '#ff9900', 2.2, 5.0, 1.6, 0.8);

    // 4. Heavy camera shake & divine impact sound
    context.cameraController.addTrauma(0.95);
    context.audioManager.playCelestialSword();
  }

  /**
   * Secondary tectonic pulse waves while impaled in the planet.
   */
  private triggerResonantPulse(s: ActiveSword, context: WeaponContext): void {
    const planetRadius = context.planet.config.radius;

    // Secondary localized damage impact
    context.planet.registerImpact({
      u: s.targetUV.u,
      v: s.targetUV.v,
      lat: s.targetLat,
      lon: s.targetLon,
      position: s.targetPos,
      radius: this.config.damageRadius * 0.65,
      intensity: this.config.damageIntensity * 0.45,
      heat: 0.8,
      timestamp: performance.now(),
    });

    // Expanding resonance ring
    context.shockwaveSystem.create(s.targetPos, s.targetNormal, planetRadius * 0.7, '#00e5ff');

    // Trauma pulse
    context.cameraController.addTrauma(0.35);

    // Holy spark burst
    context.particleSystem.emit(s.targetPos, s.targetNormal, 24, '#88ffff', 1.8, 4.0, 1.0, 0.5);
  }

  public dispose(): void {
    for (const s of this.activeSwords) {
      disposeNode(s.group);
      disposeNode(s.mandalaGroup);
      disposeNode(s.lightBeam);
    }
    this.activeSwords = [];
  }
}
