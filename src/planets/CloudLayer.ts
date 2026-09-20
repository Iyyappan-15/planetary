import * as THREE from 'three';
import { CloudProfile } from '../types/planet';
import { ProceduralTextures } from '../utils/textures';
import { disposeNode } from '../utils/disposal';

export class CloudLayer {
  public mesh: THREE.Mesh;
  public texture: THREE.Texture;
  private rotationSpeed: number;
  private material: THREE.ShaderMaterial;

  constructor(radius: number, profile: CloudProfile, isEarth: boolean = false, sunDirection: THREE.Vector3 = new THREE.Vector3(1, 1, 1)) {
    this.rotationSpeed = profile.speed;
    const geometry = new THREE.SphereGeometry(radius * (1.0 + (profile.altitude || 0.018)), 64, 64);

    if (isEarth) {
      const loader = new THREE.TextureLoader();
      this.texture = loader.load('./earth_clouds.png');
      this.texture.wrapS = THREE.RepeatWrapping;
      this.texture.wrapT = THREE.ClampToEdgeWrapping;
      this.texture.colorSpace = THREE.SRGBColorSpace;
    } else {
      this.texture = ProceduralTextures.createCloudTexture(1024, 512, profile.seed);
    }

    // High-fidelity Google Earth cloud shader with forward Mie scattering
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tClouds: { value: this.texture },
        uSunDirection: { value: sunDirection.clone() },
        uOpacity: { value: isEarth ? 0.92 : profile.opacity },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D tClouds;
        uniform vec3 uSunDirection;
        uniform float uOpacity;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDir;

        void main() {
          vec4 cloudSample = texture2D(tClouds, vUv);
          float density = cloudSample.r;
          if (density < 0.04) discard;

          vec3 sunDir = normalize(uSunDirection);
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(vViewDir);

          // Atmospheric sunlight illumination
          float NdotL = dot(normal, sunDir);
          float daylight = smoothstep(-0.25, 0.35, NdotL);
          float illum = 0.42 + 0.58 * daylight;

          // Atmospheric Rayleigh limb glow on cloud tops
          float rim = 1.0 - max(dot(normal, viewDir), 0.0);
          float rimGlow = pow(rim, 3.2) * 0.4;

          // Pure brilliant white clouds with soft atmospheric blue rim
          vec3 cloudColor = mix(vec3(1.0, 1.0, 0.98) * illum, vec3(0.55, 0.82, 1.0), rimGlow);

          // Soft volumetric density falloff (fluffy white center, soft wispy edges)
          float alpha = smoothstep(0.04, 0.65, density) * uOpacity * (0.35 + 0.65 * daylight);

          gl_FragColor = vec4(cloudColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  public update(delta: number, sunDirection?: THREE.Vector3): void {
    this.mesh.rotation.y += this.rotationSpeed * delta;
    if (sunDirection && this.material.uniforms.uSunDirection) {
      this.material.uniforms.uSunDirection.value.copy(sunDirection);
    }
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    disposeNode(this.mesh);
  }
}
