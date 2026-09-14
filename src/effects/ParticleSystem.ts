import * as THREE from 'three';
import { disposeNode } from '../utils/disposal';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  public group: THREE.Group;
  private maxParticles: number;
  private particles: Particle[] = [];
  private points: THREE.Points;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;

  constructor(maxParticles: number = 1000) {
    this.maxParticles = maxParticles;
    this.group = new THREE.Group();

    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);

    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        color: new THREE.Color(1, 1, 1),
        size: 1.0,
        life: 0,
        maxLife: 1.0,
      });
      this.sizes[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.group.add(this.points);
  }

  public emit(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    count: number,
    colorHex: string = '#ff7700',
    speedMin: number = 1.0,
    speedMax: number = 4.0,
    lifespan: number = 1.5,
    spread: number = 0.8
  ): void {
    const baseColor = new THREE.Color(colorHex);
    let spawned = 0;

    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.position.copy(origin);

      // Conical spread around surface normal / direction
      const randomDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      p.velocity.copy(direction).lerp(randomDir, spread).normalize();
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.velocity.multiplyScalar(speed);

      // Color variation
      p.color.copy(baseColor);
      p.color.r = Math.min(1, p.color.r * (0.8 + Math.random() * 0.4));
      p.color.g = Math.min(1, p.color.g * (0.8 + Math.random() * 0.4));

      p.life = 0;
      p.maxLife = lifespan * (0.7 + Math.random() * 0.6);
      p.size = 2.0 + Math.random() * 3.5;

      spawned++;
    }
  }

  public update(delta: number, gravityTarget?: THREE.Vector3 | null): void {
    let hasActive = false;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.sizes[i] = 0;
        continue;
      }

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.sizes[i] = 0;
        continue;
      }

      hasActive = true;

      // Gravity pull
      if (gravityTarget) {
        const pull = gravityTarget.clone().sub(p.position);
        const distSq = Math.max(0.25, pull.lengthSq());
        pull.normalize();
        p.velocity.addScaledVector(pull, (8.0 / distSq) * delta);
      }

      // Physics integration
      p.position.addScaledVector(p.velocity, delta);
      p.velocity.multiplyScalar(0.985); // Gentle drag

      const lifeProgress = p.life / p.maxLife;
      const fade = 1.0 - lifeProgress;

      this.positions[i * 3] = p.position.x;
      this.positions[i * 3 + 1] = p.position.y;
      this.positions[i * 3 + 2] = p.position.z;

      this.colors[i * 3] = p.color.r * fade;
      this.colors[i * 3 + 1] = p.color.g * fade;
      this.colors[i * 3 + 2] = p.color.b * fade;

      this.sizes[i] = p.size * (0.3 + 0.7 * fade);
    }

    if (hasActive) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      this.geometry.attributes.size.needsUpdate = true;
    }
  }

  public clear(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.sizes[i] = 0;
    }
    this.geometry.attributes.size.needsUpdate = true;
  }

  public dispose(): void {
    this.clear();
    disposeNode(this.group);
  }
}
