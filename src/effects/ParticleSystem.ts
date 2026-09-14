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

function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Smooth radial glow
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.2, 'rgba(255, 230, 180, 0.85)');
  grad.addColorStop(0.5, 'rgba(255, 120, 30, 0.35)');
  grad.addColorStop(0.8, 'rgba(255, 60, 10, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
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
  private spriteTexture: THREE.CanvasTexture;

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
        size: 0.1,
        life: 0,
        maxLife: 1.0,
      });
      this.sizes[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.spriteTexture = createParticleTexture();

    this.material = new THREE.PointsMaterial({
      size: 0.16,
      map: this.spriteTexture,
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
    speedMin: number = 0.8,
    speedMax: number = 3.2,
    lifespan: number = 1.2,
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
      p.color.r = Math.min(1, p.color.r * (0.85 + Math.random() * 0.3));
      p.color.g = Math.min(1, p.color.g * (0.85 + Math.random() * 0.3));

      p.life = 0;
      p.maxLife = lifespan * (0.6 + Math.random() * 0.8);
      p.size = 0.08 + Math.random() * 0.14;

      spawned++;
    }
  }

  public update(delta: number, gravityTarget?: THREE.Vector3 | null): void {
    let hasActive = false;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = 0;
        this.positions[i * 3 + 2] = 0;
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
        continue;
      }

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = 0;
        this.positions[i * 3 + 2] = 0;
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
        continue;
      }

      hasActive = true;

      // Gravity pull
      if (gravityTarget) {
        const pull = gravityTarget.clone().sub(p.position);
        const distSq = Math.max(0.2, pull.lengthSq());
        pull.normalize();
        p.velocity.addScaledVector(pull, (10.0 / distSq) * delta);
      }

      // Physics integration
      p.position.addScaledVector(p.velocity, delta);
      p.velocity.multiplyScalar(0.975); // Air/space resistance

      const lifeProgress = p.life / p.maxLife;
      const fade = Math.max(0, 1.0 - lifeProgress);

      this.positions[i * 3] = p.position.x;
      this.positions[i * 3 + 1] = p.position.y;
      this.positions[i * 3 + 2] = p.position.z;

      this.colors[i * 3] = p.color.r * fade;
      this.colors[i * 3 + 1] = p.color.g * fade;
      this.colors[i * 3 + 2] = p.color.b * fade;
    }

    if (hasActive) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  public clear(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = 0;
      this.colors[i * 3] = 0;
      this.colors[i * 3 + 1] = 0;
      this.colors[i * 3 + 2] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public dispose(): void {
    this.clear();
    this.spriteTexture.dispose();
    disposeNode(this.group);
  }
}
