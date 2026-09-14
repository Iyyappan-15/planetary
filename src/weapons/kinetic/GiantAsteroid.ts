import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveAsteroid {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  targetUV: { u: number; v: number };
  progress: number;
  speed: number;
}

export class GiantAsteroidWeapon extends Weapon {
  private activeAsteroids: ActiveAsteroid[] = [];
  private geo: THREE.DodecahedronGeometry;
  private mat: THREE.MeshStandardMaterial;

  constructor() {
    super({
      id: 'giant_asteroid',
      name: 'Giant Asteroid',
      category: 'kinetic',
      description: 'City-sized celestial asteroid delivering extinction-level kinetic energy.',
      cooldownMs: 1500,
      iconName: 'CircleDot',
      keyShortcut: '5',
      damageRadius: 0.16,
      damageIntensity: 1.2,
    });

    this.geo = new THREE.DodecahedronGeometry(0.55, 2);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x443322,
      roughness: 0.95,
      emissive: 0xff3300,
      emissiveIntensity: 0.9,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 12.0);
    startPos.x += (Math.random() - 0.5) * 3.0;

    const mesh = new THREE.Mesh(this.geo, this.mat.clone());
    mesh.position.copy(startPos);
    context.scene.add(mesh);

    this.activeAsteroids.push({
      mesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      targetUV: { ...target.uv },
      progress: 0,
      speed: 2.8,
    });
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeAsteroids.length - 1; i >= 0; i--) {
      const ast = this.activeAsteroids[i];
      ast.progress += ast.speed * delta;

      if (ast.progress >= 1.0) {
        // Catastrophic impact
        context.planet.registerImpact({
          u: ast.targetUV.u,
          v: ast.targetUV.v,
          position: ast.targetPos,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 0.9,
          timestamp: performance.now(),
        });

        context.shockwaveSystem.create(ast.targetPos, ast.targetNormal, context.planet.config.radius * 0.8, '#ff6600');
        context.particleSystem.emit(ast.targetPos, ast.targetNormal, 100, '#ff4400', 2.0, 7.0, 1.8, 0.9);
        context.cameraController.addTrauma(0.75);
        context.audioManager.playMeteorImpact();

        context.scene.remove(ast.mesh);
        disposeNode(ast.mesh);
        this.activeAsteroids.splice(i, 1);
        continue;
      }

      ast.mesh.position.lerpVectors(ast.startPos, ast.targetPos, ast.progress);
      ast.mesh.rotation.x += delta * 3.0;
      ast.mesh.rotation.y += delta * 4.0;

      // Heavy fire plume
      context.particleSystem.emit(ast.mesh.position, ast.targetNormal, 4, '#ff8800', 0.5, 1.5, 0.4, 0.4);
    }
  }

  public dispose(): void {
    for (const a of this.activeAsteroids) {
      disposeNode(a.mesh);
    }
    this.activeAsteroids = [];
    this.geo.dispose();
    this.mat.dispose();
  }
}
