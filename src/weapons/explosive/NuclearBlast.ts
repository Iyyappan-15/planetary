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

export class NuclearBlastWeapon extends Weapon {
  private fireballs: ActiveFireball[] = [];
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

    const blastPos = target.point.clone().addScaledVector(target.normal, 0.08);

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
      u: target.uv.u,
      v: target.uv.v,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // 5. Shockwave ring expanding across the atmosphere
    context.shockwaveSystem.create(
      target.point,
      target.normal,
      context.planet.config.radius * 0.85,
      '#ffe099'
    );

    // 6. Plume of glowing embers and hot ejecta
    context.particleSystem.emit(
      target.point,
      target.normal,
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
    this.sphereGeo.dispose();
  }
}
