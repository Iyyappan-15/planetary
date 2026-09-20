import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActivePunch {
  group: THREE.Group;
  portalGroup: THREE.Group;
  auraMesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  timer: number;
  hasImpacted: boolean;
  lingerTimer: number;
}

export class CelestialPunchWeapon extends Weapon {
  private activePunches: ActivePunch[] = [];

  constructor() {
    super({
      id: 'celestial_punch',
      name: 'Celestial Punch',
      category: 'monsters',
      description: 'Colossal cosmic deity fist manifesting from a dimensional rift and delivering a seismic god-strike into the planet.',
      cooldownMs: 2500,
      iconName: 'Hand',
      damageRadius: 0.16,
      damageIntensity: 1.2,
    });
  }

  /**
   * Creates a dimensional celestial rift portal where the god fist emerges.
   */
  private createPortalMesh(): THREE.Group {
    const portal = new THREE.Group();

    // 1. Swirling Outer Accretion Ring
    const outerRingGeo = new THREE.TorusGeometry(1.8, 0.08, 16, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    portal.add(outerRing);

    // 2. Inner Cosmic Energy Disc
    const discGeo = new THREE.RingGeometry(0.1, 1.75, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xaa22ff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    portal.add(disc);

    // 3. Counter-rotating Rune Ring
    const runeRingGeo = new THREE.TorusGeometry(1.4, 0.05, 12, 48);
    const runeRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const runeRing = new THREE.Mesh(runeRingGeo, runeRingMat);
    portal.add(runeRing);

    return portal;
  }

  /**
   * Creates an intricate, awe-inspiring Celestial Titan Fist.
   * Sculpted with anatomical finger segments, knuckle energy cores,
   * an armored forearm with starlight conduits, and a radiant aura.
   */
  private createTitanFistMesh(): { group: THREE.Group; auraMesh: THREE.Mesh } {
    const group = new THREE.Group();

    // Primary Celestial Obsidian Armor Material
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1622,
      emissive: 0x551100,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.9,
    });

    // Radiant Gold Celestial Plates Material
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffb700,
      emissive: 0xff5500,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.85,
    });

    // Intense Incandescent Knuckle & Energy Conduit Core Material
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffea55,
    });

    // ================= 1. FOREARM & BRACER =================
    // Tapered muscular forearm (thick near elbow, streamlined to wrist)
    const armGeo = new THREE.CylinderGeometry(0.42, 0.58, 2.2, 20);
    const arm = new THREE.Mesh(armGeo, armorMat);
    arm.position.set(0, 0, -1.25);
    arm.rotation.x = Math.PI / 2;
    group.add(arm);

    // Lateral forearm muscle plate ridge (brachioradialis armor contour)
    const ridgeGeo = new THREE.BoxGeometry(0.22, 1.8, 0.28);
    const ridgeLeft = new THREE.Mesh(ridgeGeo, goldMat);
    ridgeLeft.position.set(0.38, 0.05, -1.25);
    ridgeLeft.rotation.z = -0.15;
    group.add(ridgeLeft);

    const ridgeRight = new THREE.Mesh(ridgeGeo, goldMat);
    ridgeRight.position.set(-0.38, 0.05, -1.25);
    ridgeRight.rotation.z = 0.15;
    group.add(ridgeRight);

    // Glowing starlight veins running down the forearm
    const veinGeo = new THREE.BoxGeometry(0.06, 1.6, 0.1);
    const vein = new THREE.Mesh(veinGeo, coreMat);
    vein.position.set(0, 0.44, -1.25);
    group.add(vein);

    // Ornate Wrist Gauntlet / Bracer Ring
    const bracerGeo = new THREE.CylinderGeometry(0.5, 0.52, 0.45, 20);
    const bracer = new THREE.Mesh(bracerGeo, goldMat);
    bracer.position.set(0, 0, -0.32);
    bracer.rotation.x = Math.PI / 2;
    group.add(bracer);

    // Wrist power gems (3 embedded glowing crystals around the bracer)
    const gemGeo = new THREE.OctahedronGeometry(0.09);
    for (let i = -1; i <= 1; i++) {
      const gem = new THREE.Mesh(gemGeo, coreMat);
      gem.position.set(i * 0.32, 0.45, -0.32);
      group.add(gem);
    }

    // ================= 2. PALM & METACARPAL BACKPLATE =================
    // Sturdy, contoured palm & back of hand
    const palmGeo = new THREE.BoxGeometry(0.88, 0.52, 0.65);
    const palm = new THREE.Mesh(palmGeo, armorMat);
    palm.position.set(0, 0, 0.18);
    group.add(palm);

    // Back-of-hand protective celestial crest plate
    const backplateGeo = new THREE.BoxGeometry(0.78, 0.18, 0.52);
    const backplate = new THREE.Mesh(backplateGeo, goldMat);
    backplate.position.set(0, 0.28, 0.18);
    group.add(backplate);

    // ================= 3. FOUR ARTICULATED FINGERS =================
    // Each finger has proximal knuckle, intermediate bend, and curled distal phalanx
    const fingerSpacing = 0.21;
    const fingerWidth = 0.17;

    for (let f = 0; f < 4; f++) {
      const posX = -0.315 + f * fingerSpacing;
      const fingerGroup = new THREE.Group();
      fingerGroup.position.set(posX, 0, 0.45);

      // Metacarpophalangeal Joint (The Main Knuckle Sphere)
      const knuckleGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const knuckle = new THREE.Mesh(knuckleGeo, armorMat);
      knuckle.position.set(0, 0.15, 0);
      fingerGroup.add(knuckle);

      // Knuckle Glowing Core / Energy Cap
      const capGeo = new THREE.ConeGeometry(0.08, 0.18, 8);
      const cap = new THREE.Mesh(capGeo, coreMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(0, 0.16, 0.12);
      fingerGroup.add(cap);

      // Proximal Phalanx (angled forward and down)
      const proxGeo = new THREE.BoxGeometry(fingerWidth, 0.26, 0.34);
      const prox = new THREE.Mesh(proxGeo, goldMat);
      prox.position.set(0, 0.08, 0.18);
      prox.rotation.x = 0.45;
      fingerGroup.add(prox);

      // Middle & Distal Phalanx (curled inwards tightly into the palm)
      const distGeo = new THREE.BoxGeometry(fingerWidth * 0.92, 0.32, 0.28);
      const dist = new THREE.Mesh(distGeo, armorMat);
      dist.position.set(0, -0.16, 0.26);
      dist.rotation.x = -0.75;
      fingerGroup.add(dist);

      group.add(fingerGroup);
    }

    // ================= 4. REINFORCED HEAVY THUMB =================
    const thumbGroup = new THREE.Group();
    thumbGroup.position.set(-0.36, -0.05, 0.26);
    thumbGroup.rotation.z = -0.55;
    thumbGroup.rotation.y = 0.45;

    // Thumb Base Joint
    const thumbBaseGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const thumbBase = new THREE.Mesh(thumbBaseGeo, goldMat);
    thumbGroup.add(thumbBase);

    // Thumb Body clamped down across the fingers
    const thumbBodyGeo = new THREE.BoxGeometry(0.55, 0.22, 0.3);
    const thumbBody = new THREE.Mesh(thumbBodyGeo, armorMat);
    thumbBody.position.set(0.24, 0.12, 0.14);
    thumbBody.rotation.z = 0.35;
    thumbGroup.add(thumbBody);

    // Thumb Glowing Strike Point
    const thumbGlowGeo = new THREE.BoxGeometry(0.35, 0.06, 0.12);
    const thumbGlow = new THREE.Mesh(thumbGlowGeo, coreMat);
    thumbGlow.position.set(0.24, 0.24, 0.14);
    thumbGroup.add(thumbGlow);

    group.add(thumbGroup);

    // ================= 5. ETHEREAL CELESTIAL ENERGY AURA =================
    // Translucent glowing forcefield encasing the fist
    const auraGeo = new THREE.IcosahedronGeometry(1.05, 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.position.set(0, 0, 0.3);
    auraMesh.scale.set(1.1, 0.9, 1.4);
    group.add(auraMesh);

    return { group, auraMesh };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // Spawn 9 units out in deep space directly above target normal
    const startPos = target.point.clone().addScaledVector(target.normal, 9.5);

    // 1. Create and position the dimensional portal in deep space
    const portalGroup = this.createPortalMesh();
    portalGroup.position.copy(startPos);
    portalGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), target.normal);
    context.scene.add(portalGroup);

    // 2. Create the articulated titan fist
    const { group, auraMesh } = this.createTitanFistMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    // Start tucked inside the portal
    group.scale.set(0.01, 0.01, 0.01);
    context.scene.add(group);

    // Initial celestial portal rift sound & particle eruption
    context.audioManager.playPlanetDestroyerCharge();
    context.particleSystem.emit(startPos, target.normal, 45, '#ffaa00', 1.5, 4.0, 1.2, 0.6);

    this.activePunches.push({
      group,
      portalGroup,
      auraMesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      timer: 0,
      hasImpacted: false,
      lingerTimer: 2.5, // Holds impact crater for 2.5 seconds
    });
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activePunches.length - 1; i >= 0; i--) {
      const p = this.activePunches[i];
      p.timer += delta;

      // Spin dimensional portal accretion rings
      p.portalGroup.rotation.z += delta * 2.5;

      // Pulse celestial aura
      const auraMat = p.auraMesh.material as THREE.MeshBasicMaterial;
      auraMat.opacity = 0.25 + Math.sin(p.timer * 12.0) * 0.15;

      if (!p.hasImpacted) {
        // Total flight duration: 1.6 seconds
        const strikeDuration = 1.6;
        const rawProgress = Math.min(1.0, p.timer / strikeDuration);

        if (rawProgress < 0.35) {
          // PHASE 1: EMERGENCE FROM DIMENSIONAL RIFT (0.0 to 0.35)
          // The fist emerges from the rift portal, expanding to its massive scale
          const emergeT = rawProgress / 0.35;
          const scale = Math.sin((emergeT * Math.PI) / 2);
          p.group.scale.set(scale, scale, scale);

          // Slowly push out of portal
          p.group.position.lerpVectors(
            p.startPos,
            p.startPos.clone().addScaledVector(p.targetNormal, -1.8),
            emergeT
          );

          // Gathering energy sparks
          if (Math.random() < 0.5) {
            context.particleSystem.emit(p.group.position, p.targetNormal, 3, '#ffcc00', 0.4, 1.2, 0.4, 0.2);
          }
        } else {
          // PHASE 2: RELATIVISTIC CELESTIAL STRIKE (0.35 to 1.0)
          // Relativistic acceleration towards planet surface with power curve
          const diveT = (rawProgress - 0.35) / 0.65;
          const diveEase = Math.pow(diveT, 2.8); // Dramatic exponential slam

          p.group.scale.set(1.0, 1.0, 1.0);
          p.group.position.lerpVectors(
            p.startPos.clone().addScaledVector(p.targetNormal, -1.8),
            p.targetPos,
            diveEase
          );

          // Supersonic ionization shock cone
          context.particleSystem.emit(
            p.group.position,
            p.targetNormal,
            4,
            '#ff8800',
            0.6,
            2.0,
            0.4,
            0.3
          );
        }

        if (rawProgress >= 1.0) {
          p.hasImpacted = true;
          p.group.position.copy(p.targetPos);
          this.onImpact(p, context);
        }
      } else {
        // PHASE 3: THE SEISMIC CRATER PLANT (Linger for 2.5s)
        p.lingerTimer -= delta;

        // Slight grinding tremor in the crater
        const rumble = (Math.random() - 0.5) * 0.015;
        p.group.position.copy(p.targetPos).addScaledVector(p.targetNormal, rumble);

        // Heavy incandescent smoke & heat radiation
        if (Math.random() < 0.4) {
          context.particleSystem.emit(
            p.targetPos,
            p.targetNormal,
            3,
            '#ff6600',
            0.5,
            1.8,
            0.4,
            0.2
          );
        }

        // Dissolution into cosmic stardust in the final 0.8s
        if (p.lingerTimer <= 0.8) {
          const fadeT = Math.max(0, p.lingerTimer / 0.8);
          p.group.scale.set(fadeT, fadeT, fadeT);
          p.portalGroup.scale.set(fadeT, fadeT, fadeT);
        }

        if (p.lingerTimer <= 0) {
          context.scene.remove(p.group);
          context.scene.remove(p.portalGroup);
          disposeNode(p.group);
          disposeNode(p.portalGroup);
          this.activePunches.splice(i, 1);
        }
      }
    }
  }

  private onImpact(p: ActivePunch, context: WeaponContext): void {
    // 1. Devastating kinetic and thermal impact on crust
    context.planet.registerImpact({
      u: p.targetUV.u,
      v: p.targetUV.v,
      lat: p.targetLat,
      lon: p.targetLon,
      position: p.targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // 2. Dual expanding seismic shockwave rings
    context.shockwaveSystem.create(p.targetPos, p.targetNormal, context.planet.config.radius * 1.2, '#ffaa00');
    context.shockwaveSystem.create(p.targetPos, p.targetNormal, context.planet.config.radius * 0.6, '#ff3300');

    // 3. Colossal volcanic ejecta & starlight burst
    context.particleSystem.emit(p.targetPos, p.targetNormal, 110, '#ffbb00', 3.0, 7.5, 2.2, 1.1);
    context.particleSystem.emit(p.targetPos, p.targetNormal, 60, '#ff2200', 2.0, 5.0, 1.5, 0.8);

    // 4. Heavy camera trauma & thunderous audio
    context.cameraController.addTrauma(0.85);
    context.audioManager.playCelestialPunch();
  }

  public dispose(): void {
    for (const p of this.activePunches) {
      disposeNode(p.group);
      disposeNode(p.portalGroup);
    }
    this.activePunches = [];
  }
}
