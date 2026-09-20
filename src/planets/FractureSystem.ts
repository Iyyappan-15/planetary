import * as THREE from 'three';
import { disposeNode } from '../utils/disposal';

interface ChunkParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationalVelocity: THREE.Vector3;
  initialPos: THREE.Vector3;
  initialRot: THREE.Euler;
  baseEmissiveIntensity: number;
}

interface CoreFragment {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationalVelocity: THREE.Vector3;
}

export class FractureSystem {
  public group: THREE.Group;
  private chunks: ChunkParticle[] = [];
  private coreFragments: CoreFragment[] = [];
  public isFractured: boolean = false;
  public isCoreDestroyed: boolean = false;

  private coreGlowMesh: THREE.Mesh | null = null;
  private coreFlashMesh: THREE.Mesh | null = null;
  private radius: number;
  private coreColorHex: string;
  private breakupElapsed: number = 0;

  // Callback to notify Game / Audio / Camera of core detonation
  public onCoreExplode?: () => void;

  constructor(radius: number, coreColorHex: string = '#ff3300') {
    this.radius = radius;
    this.coreColorHex = coreColorHex;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.createSystem();
  }

  private createSystem(): void {
    this.createCore();
    this.createChunks();
  }

  private createCore(): void {
    if (this.coreGlowMesh) {
      this.group.remove(this.coreGlowMesh);
      disposeNode(this.coreGlowMesh);
      this.coreGlowMesh = null;
    }

    // Inner incandescent molten core
    const coreGeo = new THREE.SphereGeometry(this.radius * 0.42, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.coreColorHex),
      emissive: new THREE.Color(this.coreColorHex),
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.2,
    });
    this.coreGlowMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreGlowMesh);
  }

  private createChunks(): void {
    // Clear previous chunks
    for (const chunk of this.chunks) {
      this.group.remove(chunk.mesh);
      disposeNode(chunk.mesh);
    }
    this.chunks = [];

    const chunkCount = 36;
    const coreColor = new THREE.Color(this.coreColorHex);

    for (let i = 0; i < chunkCount; i++) {
      // Golden spiral distribution on sphere surface
      const phi = Math.acos(1 - (2 * (i + 0.5)) / chunkCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).normalize();

      // Irregular jagged asteroid chunk geometry (perturbed dodecahedron)
      const baseChunkR = this.radius * (0.24 + Math.random() * 0.2);
      const geo = new THREE.DodecahedronGeometry(baseChunkR, 1);

      // Jitter vertices to create organic, sharp fracture facets
      const posAttr = geo.attributes.position;
      for (let v = 0; v < posAttr.count; v++) {
        const vx = posAttr.getX(v) * (0.8 + Math.random() * 0.4);
        const vy = posAttr.getY(v) * (0.75 + Math.random() * 0.45);
        const vz = posAttr.getZ(v) * (0.8 + Math.random() * 0.4);
        posAttr.setXYZ(v, vx, vy, vz);
      }
      geo.computeVertexNormals();

      // Rocky outer silicate crust with glowing incandescent mantle seams
      const chunkMat = new THREE.MeshStandardMaterial({
        color: 0x221d18,
        roughness: 0.92,
        metalness: 0.1,
        emissive: coreColor,
        emissiveIntensity: 1.1,
        flatShading: true,
      });

      const mesh = new THREE.Mesh(geo, chunkMat);
      // Non-uniform scaling for tectonic plate variety
      mesh.scale.set(
        0.8 + Math.random() * 0.5,
        0.7 + Math.random() * 0.4,
        0.9 + Math.random() * 0.5
      );

      const pos = dir.clone().multiplyScalar(this.radius * 0.88);
      mesh.position.copy(pos);
      mesh.lookAt(dir.clone().multiplyScalar(this.radius * 3));

      this.group.add(mesh);

      this.chunks.push({
        mesh,
        velocity: dir.clone().multiplyScalar(0.7 + Math.random() * 1.6),
        rotationalVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5
        ),
        initialPos: pos.clone(),
        initialRot: mesh.rotation.clone(),
        baseEmissiveIntensity: 1.1,
      });
    }
  }

  public triggerBreakup(epicenter?: THREE.Vector3): void {
    if (this.isFractured) return;
    this.isFractured = true;
    this.isCoreDestroyed = false;
    this.breakupElapsed = 0;
    this.group.visible = true;

    for (const chunk of this.chunks) {
      if (epicenter) {
        // Directed shock impulse from impact point
        const blastDir = chunk.mesh.position.clone().sub(epicenter).normalize();
        chunk.velocity.add(blastDir.multiplyScalar(2.2 + Math.random() * 3.0));
      }
    }
  }

  private detonateCore(): void {
    if (this.isCoreDestroyed) return;
    this.isCoreDestroyed = true;

    // 1. Remove and destroy the inner core mesh
    if (this.coreGlowMesh) {
      this.group.remove(this.coreGlowMesh);
      disposeNode(this.coreGlowMesh);
      this.coreGlowMesh = null;
    }

    // 2. Spawn blinding expanding core flash sphere
    const flashGeo = new THREE.SphereGeometry(this.radius * 0.6, 24, 24);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.group.add(this.coreFlashMesh);

    // 3. Spawn high-velocity superheated core fragments
    const fragmentCount = 48;
    const coreColor = new THREE.Color(this.coreColorHex);
    for (let i = 0; i < fragmentCount; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      const fragGeo = new THREE.DodecahedronGeometry(this.radius * (0.05 + Math.random() * 0.08), 0);
      const fragMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: coreColor,
        emissiveIntensity: 2.5,
        roughness: 0.4,
        metalness: 0.8,
        flatShading: true,
      });

      const fragMesh = new THREE.Mesh(fragGeo, fragMat);
      fragMesh.position.set(0, 0, 0);
      this.group.add(fragMesh);

      this.coreFragments.push({
        mesh: fragMesh,
        velocity: dir.multiplyScalar(3.5 + Math.random() * 6.5),
        rotationalVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 8.0
        ),
      });
    }

    // 4. Fire external callback for sound / trauma
    this.onCoreExplode?.();
  }

  public update(delta: number, gravityWellPos?: THREE.Vector3 | null): void {
    if (!this.isFractured) return;
    this.breakupElapsed += delta;

    // 1. Core Destruction Lifecycle:
    // 0.0s - 1.5s: Thermal destabilization & violent jitter
    // 1.5s - 1.9s: Gravitational squeeze / pre-detonation collapse
    // 1.9s: CATASTROPHIC CORE EXPLOSION (Core is eliminated)
    // 1.9s+: Center is completely empty space!
    if (!this.isCoreDestroyed && this.coreGlowMesh) {
      if (this.breakupElapsed < 1.5) {
        // High frequency instability tremor
        const jitter = (Math.random() - 0.5) * 0.04 * (this.breakupElapsed / 1.5);
        const pulse = 1.0 + Math.sin(this.breakupElapsed * 24.0) * 0.08;
        const scale = (pulse + jitter);
        this.coreGlowMesh.scale.set(scale, scale, scale);

        // Core color ramps up to blinding white-hot
        const mat = this.coreGlowMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.5 + (this.breakupElapsed / 1.5) * 3.0;
        mat.emissive.setRGB(1.0, 0.4 + (this.breakupElapsed / 1.5) * 0.6, (this.breakupElapsed / 1.5) * 0.8);
      } else if (this.breakupElapsed < 1.9) {
        // Gravitational collapse / pre-detonation squeeze
        const collapseProgress = (this.breakupElapsed - 1.5) / 0.4;
        const squeeze = 1.0 - collapseProgress * 0.45;
        this.coreGlowMesh.scale.set(squeeze, squeeze, squeeze);

        const mat = this.coreGlowMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 4.5 + collapseProgress * 4.0;
        mat.emissive.setRGB(1.0, 1.0, 1.0); // Pure blinding white
      } else {
        // Detonation!
        this.detonateCore();
      }
    }

    // 2. Animate core detonation flash
    if (this.coreFlashMesh) {
      const flashProgress = (this.breakupElapsed - 1.9) / 0.38;
      if (flashProgress >= 1.0) {
        this.group.remove(this.coreFlashMesh);
        disposeNode(this.coreFlashMesh);
        this.coreFlashMesh = null;
      } else {
        const flashScale = 1.0 + flashProgress * 4.2;
        this.coreFlashMesh.scale.set(flashScale, flashScale, flashScale);
        (this.coreFlashMesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - flashProgress);
      }
    }

    // 3. Update high-speed core fragments
    for (let i = this.coreFragments.length - 1; i >= 0; i--) {
      const frag = this.coreFragments[i];
      frag.mesh.position.addScaledVector(frag.velocity, delta);
      frag.mesh.rotation.x += frag.rotationalVelocity.x * delta;
      frag.mesh.rotation.y += frag.rotationalVelocity.y * delta;
      frag.mesh.rotation.z += frag.rotationalVelocity.z * delta;

      // Cool down core shards as they fly into the cold cosmos
      const mat = frag.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.max(0.1, mat.emissiveIntensity - delta * 0.6);
    }

    // 4. Update large crust chunks
    const coolingFactor = Math.max(0.05, 1.0 - (this.breakupElapsed / 8.0));
    for (const chunk of this.chunks) {
      // Apply gravity pull if a singularity/gravity well exists
      if (gravityWellPos) {
        const pullDir = gravityWellPos.clone().sub(chunk.mesh.position);
        const dist = Math.max(0.5, pullDir.length());
        pullDir.normalize();
        chunk.velocity.add(pullDir.multiplyScalar((14.0 / (dist * dist)) * delta));
        chunk.velocity.multiplyScalar(0.985); // Accretion drag
      }

      chunk.mesh.position.addScaledVector(chunk.velocity, delta);
      chunk.mesh.rotation.x += chunk.rotationalVelocity.x * delta;
      chunk.mesh.rotation.y += chunk.rotationalVelocity.y * delta;
      chunk.mesh.rotation.z += chunk.rotationalVelocity.z * delta;

      // Progressive thermal cooling of magma fissures into barren space rock
      const mat = chunk.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = chunk.baseEmissiveIntensity * coolingFactor;
    }
  }

  public reset(): void {
    this.isFractured = false;
    this.isCoreDestroyed = false;
    this.breakupElapsed = 0;
    this.group.visible = false;

    // Remove flash if active
    if (this.coreFlashMesh) {
      this.group.remove(this.coreFlashMesh);
      disposeNode(this.coreFlashMesh);
      this.coreFlashMesh = null;
    }

    // Clear core fragments
    for (const frag of this.coreFragments) {
      this.group.remove(frag.mesh);
      disposeNode(frag.mesh);
    }
    this.coreFragments = [];

    // Recreate the core
    this.createCore();

    // Reset chunks
    for (const chunk of this.chunks) {
      chunk.mesh.position.copy(chunk.initialPos);
      chunk.mesh.rotation.copy(chunk.initialRot);
      chunk.velocity.copy(chunk.initialPos).normalize().multiplyScalar(0.7 + Math.random() * 1.6);
      const mat = chunk.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = chunk.baseEmissiveIntensity;
      mat.emissive.set(this.coreColorHex);
    }
  }

  public dispose(): void {
    if (this.coreFlashMesh) {
      disposeNode(this.coreFlashMesh);
      this.coreFlashMesh = null;
    }
    for (const frag of this.coreFragments) {
      disposeNode(frag.mesh);
    }
    this.coreFragments = [];
    disposeNode(this.group);
  }
}
