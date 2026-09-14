import * as THREE from 'three';

export interface PlanetMaterialOptions {
  surfaceMap: THREE.Texture;
  specularMap?: THREE.Texture | null;
  nightMap?: THREE.Texture | null;
  damageMap: THREE.Texture;
  sunDirection: THREE.Vector3;
  coreColor?: string;
  hasOcean?: boolean;
}

export class PlanetMaterial extends THREE.ShaderMaterial {
  constructor(options: PlanetMaterialOptions) {
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform sampler2D tSurface;
      uniform sampler2D tSpecular;
      uniform sampler2D tNight;
      uniform sampler2D tDamage;

      uniform vec3 uSunDirection;
      uniform vec3 uCoreColor;
      uniform float uHasOcean;
      uniform float uHasNightLights;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      void main() {
        // Base surface color
        vec4 surfaceColor = texture2D(tSurface, vUv);

        // Sample damage map:
        // R = crater depth, G = scorch/charring, B = molten core heat
        vec4 damage = texture2D(tDamage, vUv);

        // Apply scorch & charring: burns the surface dark
        float scorchFactor = clamp(damage.g * 1.5, 0.0, 0.92);
        vec3 scorchedColor = mix(surfaceColor.rgb, vec3(0.04, 0.03, 0.03), scorchFactor);

        // Lighting calculation (day / night terminator)
        vec3 sunDir = normalize(uSunDirection);
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        float NdotL = dot(normal, sunDir);
        float dayFactor = smoothstep(-0.15, 0.25, NdotL);
        float nightFactor = 1.0 - dayFactor;

        // Diffuse lighting
        vec3 diffuse = scorchedColor * (0.05 + 0.95 * dayFactor);

        // Specular highlight on oceans (day side only)
        if (uHasOcean > 0.5) {
          float specMask = texture2D(tSpecular, vUv).r;
          if (specMask > 0.3) {
            vec3 halfVector = normalize(sunDir + viewDir);
            float NdotH = max(dot(normal, halfVector), 0.0);
            float specular = pow(NdotH, 32.0) * specMask * dayFactor * 0.7;
            diffuse += vec3(1.0, 0.95, 0.85) * specular;
          }
        }

        // Night side city lights (only on dark hemisphere and where not scorched)
        if (uHasNightLights > 0.5) {
          vec3 nightLights = texture2D(tNight, vUv).rgb;
          float lightMask = nightFactor * (1.0 - scorchFactor);
          diffuse += nightLights * lightMask * 1.8;
        }

        // Molten Mantle Glow (fissure cracks & crater heat)
        float heat = clamp(damage.b * 1.8, 0.0, 1.0);
        if (heat > 0.02) {
          // Intense fiery emission
          vec3 fireColor = mix(uCoreColor, vec3(1.0, 0.95, 0.7), pow(heat, 2.5));
          diffuse += fireColor * heat * 3.2;
        }

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `;

    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        tSurface: { value: options.surfaceMap },
        tSpecular: { value: options.specularMap || new THREE.Texture() },
        tNight: { value: options.nightMap || new THREE.Texture() },
        tDamage: { value: options.damageMap },
        uSunDirection: { value: options.sunDirection.clone() },
        uCoreColor: { value: new THREE.Color(options.coreColor || '#ff4500') },
        uHasOcean: { value: options.hasOcean ? 1.0 : 0.0 },
        uHasNightLights: { value: options.nightMap ? 1.0 : 0.0 },
      },
    });
  }

  public updateSunDirection(dir: THREE.Vector3): void {
    this.uniforms.uSunDirection.value.copy(dir);
  }
}
