import * as THREE from 'three';
import { AtmosphereProfile } from '../types/planet';
import { disposeNode } from '../utils/disposal';

export class Atmosphere {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private disturbance: number = 0;

  constructor(radius: number, profile: AtmosphereProfile, sunDirection: THREE.Vector3) {
    const geometry = new THREE.SphereGeometry(radius * 1.025, 64, 64);

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 uColor;
      uniform float uDensity;
      uniform float uGlowIntensity;
      uniform float uDisturbance;
      uniform vec3 uSunDirection;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldNormal;

      void main() {
        // View direction in camera space
        vec3 viewDir = normalize(-vPosition);
        
        // Rim / Fresnel falloff
        float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);
        rim = pow(rim, 2.5);

        // Sun angle lighting: daylight side has stronger glow, night side has soft twilight
        float sunDot = max(dot(vWorldNormal, normalize(uSunDirection)), -0.1);
        float daylightFactor = smoothstep(-0.2, 0.4, sunDot);

        // Disturbance distortion (e.g. shockwave disturbance)
        float ripple = sin(vPosition.y * 12.0 + uDisturbance * 10.0) * uDisturbance * 0.2;

        float alpha = (rim * uDensity + ripple) * (0.3 + 0.7 * daylightFactor) * uGlowIntensity;
        alpha = clamp(alpha, 0.0, 1.0);

        gl_FragColor = vec4(uColor, alpha);
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
      side: THREE.BackSide,
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
