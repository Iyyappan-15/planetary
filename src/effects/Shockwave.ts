import * as THREE from 'three';
import { disposeNode } from '../utils/disposal';

interface ShockwaveInstance {
  mesh: THREE.Mesh;
  maxRadius: number;
  currentRadius: number;
  expansionSpeed: number;
  maxDuration: number;
  elapsed: number;
  baseColor: THREE.Color;
  material: THREE.ShaderMaterial;
}

export class ShockwaveSystem {
  public group: THREE.Group;
  private shockwaves: ShockwaveInstance[] = [];
  private domeGeo: THREE.SphereGeometry;

  constructor() {
    this.group = new THREE.Group();
    // Hemispherical blast dome (3D atmospheric shockwave)
    this.domeGeo = new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  }

  public create(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    maxRadius: number = 1.0,
    colorHex: string = '#ffaa44'
  ): void {
    // Clamp max radius to prevent cosmic clipping while retaining impressive scale
    const clampedMaxRadius = Math.min(1.35, Math.max(0.35, maxRadius * 0.6));
    const baseColor = new THREE.Color(colorHex);

    // Realistic atmospheric supersonic blast dome shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: baseColor },
        uProgress: { value: 0.0 },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uProgress;
        uniform float uOpacity;

        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // Fresnel rim lighting creates a razor-sharp supersonic condensation shock front
          float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)));
          float shockFront = pow(rim, 1.8) * 1.6;

          // Non-linear fade out as energy dissipates
          float alphaFade = pow(1.0 - uProgress, 1.5);
          float alpha = clamp(shockFront * uOpacity * alphaFade, 0.0, 1.0);

          // White-hot ionization at the beginning, cooling to weapon shock color
          vec3 shockColor = mix(vec3(1.0, 1.0, 0.95), uColor, clamp(uProgress * 1.8, 0.0, 1.0));

          gl_FragColor = vec4(shockColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(this.domeGeo, material);
    // Position slightly above the surface
    mesh.position.copy(position.clone().addScaledVector(normal, 0.02));
    // Orient the hemisphere outward along surface normal
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
    mesh.quaternion.copy(quat);

    mesh.scale.set(0.04, 0.04, 0.04);
    this.group.add(mesh);

    this.shockwaves.push({
      mesh,
      maxRadius: clampedMaxRadius,
      currentRadius: 0.04,
      expansionSpeed: clampedMaxRadius * 3.6,
      maxDuration: 0.42, // Fast, punchy supersonic blast
      elapsed: 0,
      baseColor,
      material,
    });
  }

  public update(delta: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.elapsed += delta;
      const progress = Math.min(1.0, sw.elapsed / sw.maxDuration);

      if (progress >= 1.0) {
        this.group.remove(sw.mesh);
        sw.material.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }

      // Fast expansion at beginning, decelerating as shock front slows down
      const scaleEase = 1.0 - Math.pow(1.0 - progress, 3.0);
      const currentScale = 0.04 + (sw.maxRadius - 0.04) * scaleEase;

      // Hemispherical dome scale: flatter along normal to hug atmosphere, wider radially
      sw.mesh.scale.set(currentScale, currentScale * 0.55, currentScale);

      // Update shader progress
      sw.material.uniforms.uProgress.value = progress;
    }
  }

  public clear(): void {
    for (const sw of this.shockwaves) {
      this.group.remove(sw.mesh);
      sw.material.dispose();
    }
    this.shockwaves = [];
  }

  public dispose(): void {
    this.clear();
    this.domeGeo.dispose();
    disposeNode(this.group);
  }
}
