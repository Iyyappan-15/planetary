import * as THREE from 'three';
import { disposeNode } from '../utils/disposal';

interface ShockwaveInstance {
  mesh: THREE.Mesh;
  maxRadius: number;
  currentRadius: number;
  expansionSpeed: number;
  opacity: number;
  color: THREE.Color;
}

export class ShockwaveSystem {
  public group: THREE.Group;
  private shockwaves: ShockwaveInstance[] = [];

  constructor() {
    this.group = new THREE.Group();
  }

  public create(position: THREE.Vector3, normal: THREE.Vector3, maxRadius: number = 2.0, colorHex: string = '#ff9933'): void {
    const geometry = new THREE.RingGeometry(0.05, 0.25, 32);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position.clone().addScaledVector(normal, 0.03));
    mesh.lookAt(position.clone().add(normal));

    this.group.add(mesh);

    this.shockwaves.push({
      mesh,
      maxRadius,
      currentRadius: 0.2,
      expansionSpeed: maxRadius * 3.5,
      opacity: 0.95,
      color: new THREE.Color(colorHex),
    });
  }

  public update(delta: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.currentRadius += sw.expansionSpeed * delta;
      const progress = sw.currentRadius / sw.maxRadius;

      if (progress >= 1.0) {
        this.group.remove(sw.mesh);
        disposeNode(sw.mesh);
        this.shockwaves.splice(i, 1);
        continue;
      }

      const scale = sw.currentRadius;
      sw.mesh.scale.set(scale, scale, scale);

      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1.0 - progress) * sw.opacity;
    }
  }

  public clear(): void {
    for (const sw of this.shockwaves) {
      this.group.remove(sw.mesh);
      disposeNode(sw.mesh);
    }
    this.shockwaves = [];
  }

  public dispose(): void {
    this.clear();
    disposeNode(this.group);
  }
}
