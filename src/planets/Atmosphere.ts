import * as THREE from 'three';
import { AtmosphereProfile } from '../types/planet';
import { disposeNode } from '../utils/disposal';

export class Atmosphere {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private disturbance: number = 0;

  constructor(radius: number, profile: AtmosphereProfile, sunDirection: THREE.Vector3) {
    const geometry = new THREE.SphereGeometry(radius * 1.045, 64, 64);

    const vertexShader = `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      uniform vec3 uColor;
      uniform float uDensity;
      uniform float uGlowIntensity;
      uniform float uDisturbance;
      uniform vec3 uSunDirection;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 normal = normalize(vWorldNormal);
        
        // Rayleigh exponential rim falloff
        float rim = 1.0 - max(dot(normal, viewDir), 0.0);
        rim = pow(rim, 4.0);

        // Daylight terminator lighting
        float sunDot = dot(normal, normalize(uSunDirection));
        float daylight = smoothstep(-0.25, 0.4, sunDot);

        // Dynamic shockwave ripple
        float ripple = sin(vWorldPosition.y * 14.0 + uDisturbance * 12.0) * uDisturbance * 0.15;

        // Sky color shifts from deep twilight violet to brilliant cyan-blue
        vec3 daylightColor = mix(uColor, vec3(0.5, 0.85, 1.0), 0.4);
        vec3 twilightColor = mix(uColor * 0.5, vec3(0.7, 0.35, 0.2), 0.3);
        vec3 finalColor = mix(twilightColor, daylightColor, daylight);

        float alpha = (rim * uDensity + ripple) * (0.2 + 0.8 * daylight) * uGlowIntensity;
        alpha = clamp(alpha, 0.0, 0.95);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(profile.color) },
        uDensity: { value: profile.density },
        uGlowIntensity: { value: profile.glowIntensity },
        uDisturbance: { value: 0 },
        uSunDirection: { value: sunDirection.clone() },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  public setDisturbance(amount: number): void {
    this.disturbance = Math.min(1.0, this.disturbance + amount);
  }

  public update(delta: number, sunDirection?: THREE.Vector3): void {
    if (this.disturbance > 0) {
      this.disturbance = Math.max(0, this.disturbance - delta * 0.8);
      this.material.uniforms.uDisturbance.value = this.disturbance;
    }
    if (sunDirection) {
      this.material.uniforms.uSunDirection.value.copy(sunDirection);
    }
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    disposeNode(this.mesh);
  }
}
