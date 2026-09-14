import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveFireball {
  coreMesh: THREE.Mesh;
  outerMesh: THREE.Mesh;
  light: THREE.PointLight;
  position: THREE.Vector3;
  currentRadius: number;
  maxRadius: number;
  duration: number;
  maxDuration: number;
}

interface ActiveMissile {
  group: THREE.Group;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  targetLat: number;
  targetLon: number;
  progress: number;
  speed: number;
}

export class NuclearBlastWeapon extends Weapon {
  private fireballs: ActiveFireball[] = [];
  private missiles: ActiveMissile[] = [];
  private sphereGeo: THREE.SphereGeometry;

  constructor() {
    super({
      id: 'nuclear_blast',
      name: 'Nuclear Blast',
      category: 'explosive',
      description: 'Cinematic thermonuclear detonation releasing a blinding incandescent fireball, supersonic pressure wave, and megacrater.',
      cooldownMs: 800,
      iconName: 'Radiation',
      keyShortcut: '3',
      damageRadius: 0.09,
      damageIntensity: 1.0,
    });

    this.sphereGeo = new THREE.SphereGeometry(1, 32, 32);
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // 1. Build hypersonic missile model
    const group = new THREE.Group();

    // Body cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.45, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x242830,
      metalness: 0.85,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Conical warhead tip
    const tipGeo = new THREE.ConeGeometry(0.06, 0.22, 8);
    tipGeo.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0, 0.33);
    group.add(tip);

    // Fiery rocket exhaust plume
    const plumeGeo = new THREE.ConeGeometry(0.05, 0.35, 8);
    plumeGeo.rotateX(-Math.PI / 2);
    const plumeMat = new THREE.MeshBasicMaterial({
      color: 0xffcc33,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.position.set(0, 0, -0.38);
    group.add(plume);

    // 2. Spawn in orbit ~9.5 units above the target normal
    const startPos = target.point.clone().addScaledVector(target.normal, 9.5);
    startPos.x += (Math.random() - 0.5) * 1.5;
    startPos.y += (Math.random() - 0.5) * 1.5;

    group.position.copy(startPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.missiles.push({
      group,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      targetLat: target.lat,
      targetLon: target.lon,
      progress: 0,
      speed: 3.4, // Plunges from orbit in ~0.29s
    });
  }

  private detonate(
    targetPos: THREE.Vector3,
    targetNormal: THREE.Vector3,
    targetUV: { u: number; v: number },
    targetLat: number,
    targetLon: number,
    context: WeaponContext
  ): void {
    const blastPos = targetPos.clone().addScaledVector(targetNormal, 0.08);

    // 1. Dynamic Flash PointLight
    const light = new THREE.PointLight(0xfff3cc, 18.0, 10.0, 1.5);
    light.position.copy(blastPos);
    context.scene.add(light);

    // 2. Inner Incandescent White-Hot Core
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(this.sphereGeo, coreMat);
    coreMesh.position.copy(blastPos);
    coreMesh.scale.set(0.05, 0.05, 0.05);
    context.scene.add(coreMesh);

    // 3. Outer Fiery Billowing Flame Sphere
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff7711,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(this.sphereGeo, outerMat);
    outerMesh.position.copy(blastPos);
    outerMesh.scale.set(0.08, 0.08, 0.08);
    context.scene.add(outerMesh);

    const maxRadius = context.planet.config.radius * 0.42;

    this.fireballs.push({
      coreMesh,
      outerMesh,
      light,
      position: blastPos,
      currentRadius: 0.05,
      maxRadius,
      duration: 0,
      maxDuration: 1.4,
    });

    // 4. Register crater in damage system
    context.planet.registerImpact({
      u: targetUV.u,
      v: targetUV.v,
      lat: targetLat,
      lon: targetLon,
      position: targetPos,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // 5. Shockwave ring expanding across the atmosphere
    context.shockwaveSystem.create(
      targetPos,
      targetNormal,
      context.planet.config.radius * 0.85,
      '#ffe099'
    );

    // 6. Plume of glowing embers and hot ejecta
    context.particleSystem.emit(
      targetPos,
      targetNormal,
      140,
      '#ff9922',
      1.2,
      4.5,
      1.8,
      0.85
    );

    // 7. Heavy camera trauma & deep sub-bass sound
    context.cameraController.addTrauma(0.85);
    context.audioManager.playNuclearBlast();
  }

  public update(delta: number, context: WeaponContext): void {
    // 1. Update descending orbital missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.progress += m.speed * delta;

      if (m.progress >= 1.0) {
        // Missile impacts target
        this.detonate(m.targetPos, m.targetNormal, m.targetUV, m.targetLat, m.targetLon, context);
        context.scene.remove(m.group);
        disposeNode(m.group);
        this.missiles.splice(i, 1);
        continue;
      }

      // Move missile toward surface
      m.group.position.lerpVectors(m.startPos, m.targetPos, m.progress);
      m.group.lookAt(m.targetPos);

      // Rocket exhaust flame trail
      context.particleSystem.emit(
        m.group.position,
        m.targetNormal.clone().negate(),
        2,
        '#ffaa22',
        0.15,
        0.7,
        0.4,
        0.5
      );
    }

    // 2. Update expanding fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.duration += delta;
      const progress = fb.duration / fb.maxDuration;

      if (progress >= 1.0) {
        context.scene.remove(fb.coreMesh);
        context.scene.remove(fb.outerMesh);
        context.scene.remove(fb.light);
        disposeNode(fb.coreMesh);
        disposeNode(fb.outerMesh);
        this.fireballs.splice(i, 1);
        continue;
      }

      // Fast expansion in first 30%, slow deceleration and dissipation
      const scaleEase = Math.sin(Math.min(1.0, progress * 1.8) * Math.PI * 0.5);
      const curRadius = fb.maxRadius * scaleEase;

      fb.coreMesh.scale.set(curRadius * 0.7, curRadius * 0.7, curRadius * 0.7);
      fb.outerMesh.scale.set(curRadius, curRadius, curRadius);

      // Light flash decays rapidly
      fb.light.intensity = Math.max(0, 18.0 * (1.0 - progress * 3.0));

      // Color transition from brilliant white-yellow to deep dark smoke
      const outerMat = fb.outerMesh.material as THREE.MeshBasicMaterial;
      const coreMat = fb.coreMesh.material as THREE.MeshBasicMaterial;

      if (progress < 0.25) {
        outerMat.color.setHex(0xffdd44);
        coreMat.opacity = 1.0;
      } else if (progress < 0.6) {
        outerMat.color.setHex(0xff4400);
        coreMat.opacity = (0.6 - progress) / 0.35;
      } else {
        outerMat.color.setHex(0x3a1505);
        coreMat.opacity = 0;
      }

      outerMat.opacity = Math.max(0, (1.0 - progress) * 0.85);
    }
  }

  public dispose(): void {
    for (const fb of this.fireballs) {
      disposeNode(fb.coreMesh);
      disposeNode(fb.outerMesh);
    }
    this.fireballs = [];

    for (const m of this.missiles) {
      disposeNode(m.group);
    }
    this.missiles = [];

    this.sphereGeo.dispose();
  }
}
