import * as THREE from 'three';
import { disposeNode } from '../utils/disposal';

interface ChunkParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationalVelocity: THREE.Vector3;
  initialPos: THREE.Vector3;
}

export class FractureSystem {
  public group: THREE.Group;
  private chunks: ChunkParticle[] = [];
  public isFractured: boolean = false;
  private coreGlowMesh: THREE.Mesh | null = null;

  constructor(radius: number, coreColorHex: string = '#ff3300') {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.createChunks(radius, coreColorHex);
  }

  private createChunks(radius: number, coreColorHex: string): void {
    const chunkCount = 20;
    const coreColor = new THREE.Color(coreColorHex);

    // Inner fiery molten core remnant
    const coreGeo = new THREE.SphereGeometry(radius * 0.45, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      wireframe: false,
    });
    this.coreGlowMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreGlowMesh);

    // Common chunky material with molten underside
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x3a3028,
      roughness: 0.85,
      metalness: 0.1,
      emissive: coreColor,
      emissiveIntensity: 0.35,
    });

    for (let i = 0; i < chunkCount; i++) {
      // Golden spiral distribution on sphere surface
      const phi = Math.acos(1 - (2 * (i + 0.5)) / chunkCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).normalize();

      // Create irregular chunk geometry (tapered wedge / box)
      const chunkW = radius * (0.35 + Math.random() * 0.25);
      const chunkH = radius * (0.25 + Math.random() * 0.2);
      const chunkD = radius * (0.35 + Math.random() * 0.25);
      const geo = new THREE.BoxGeometry(chunkW, chunkH, chunkD);

      const mesh = new THREE.Mesh(geo, chunkMat.clone());
      const pos = dir.clone().multiplyScalar(radius * 0.85);
      mesh.position.copy(pos);
      mesh.lookAt(dir.clone().multiplyScalar(radius * 2));

      this.group.add(mesh);

      this.chunks.push({
        mesh,
        velocity: dir.clone().multiplyScalar(0.8 + Math.random() * 1.5),
        rotationalVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0
        ),
        initialPos: pos.clone(),
      });
    }
  }

  public triggerBreakup(epicenter?: THREE.Vector3): void {
    if (this.isFractured) return;
    this.isFractured = true;
    this.group.visible = true;

    for (const chunk of this.chunks) {
      if (epicenter) {
        // Directed blast from impact epicenter
        const blastDir = chunk.mesh.position.clone().sub(epicenter).normalize();
        chunk.velocity.add(blastDir.multiplyScalar(2.0 + Math.random() * 2.5));
      }
    }
  }

  public update(delta: number, gravityWellPos?: THREE.Vector3 | null): void {
    if (!this.isFractured) return;

    for (const chunk of this.chunks) {
      // Apply gravity pull if a singularity/gravity well exists
      if (gravityWellPos) {
        const pullDir = gravityWellPos.clone().sub(chunk.mesh.position);
        const dist = Math.max(0.5, pullDir.length());
        pullDir.normalize();
        chunk.velocity.add(pullDir.multiplyScalar((12.0 / (dist * dist)) * delta));
        chunk.velocity.multiplyScalar(0.98); // Accretion friction
      }

      chunk.mesh.position.addScaledVector(chunk.velocity, delta);
      chunk.mesh.rotation.x += chunk.rotationalVelocity.x * delta;
      chunk.mesh.rotation.y += chunk.rotationalVelocity.y * delta;
      chunk.mesh.rotation.z += chunk.rotationalVelocity.z * delta;
    }

    // Pulse core
    if (this.coreGlowMesh) {
      const scale = 1.0 + Math.sin(performance.now() * 0.005) * 0.05;
      this.coreGlowMesh.scale.set(scale, scale, scale);
    }
  }

  public reset(): void {
    this.isFractured = false;
    this.group.visible = false;
    for (const chunk of this.chunks) {
      chunk.mesh.position.copy(chunk.initialPos);
      chunk.mesh.rotation.set(0, 0, 0);
      chunk.velocity.copy(chunk.initialPos).normalize().multiplyScalar(0.8 + Math.random() * 1.5);
    }
  }

  public dispose(): void {
    disposeNode(this.group);
  }
}
