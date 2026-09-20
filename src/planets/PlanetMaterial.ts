import * as THREE from 'three';

export interface PlanetMaterialOptions {
  surfaceMap: THREE.Texture;
  normalMap?: THREE.Texture | null;
  specularMap?: THREE.Texture | null;
  nightMap?: THREE.Texture | null;
  damageMap: THREE.Texture;
  sunDirection: THREE.Vector3;
  coreColor?: string;
  hasOcean?: boolean;
  isStar?: boolean;
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
      uniform sampler2D tNormal;
      uniform sampler2D tSpecular;
      uniform sampler2D tNight;
      uniform sampler2D tDamage;

      uniform vec3 uSunDirection;
      uniform vec3 uCoreColor;
      uniform float uHasOcean;
      uniform float uHasNightLights;
      uniform float uHasNormalMap;
      uniform float uIsStar;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      void main() {
        // Base surface color
        vec4 surfaceColor = texture2D(tSurface, vUv);

        // Google Earth style color grading: boost continental contrast and saturation
        vec3 rawRgb = surfaceColor.rgb;
        // Contrast enhancement
        vec3 gradedRgb = mix(rawRgb, rawRgb * rawRgb * (3.0 - 2.0 * rawRgb), 0.28);
        // Vibrance: enrich greens and blues
        float maxC = max(gradedRgb.r, max(gradedRgb.g, gradedRgb.b));
        float minC = min(gradedRgb.r, min(gradedRgb.g, gradedRgb.b));
        float sat = (maxC - minC) / (maxC + 0.001);
        gradedRgb = mix(gradedRgb, gradedRgb * 1.15, (1.0 - sat) * 0.25);

        // Sample damage map:
        // R = crater depth, G = scorch/charring, B = molten core heat
        vec4 damage = texture2D(tDamage, vUv);

        // Apply scorch & charring: burns the surface dark
        float scorchFactor = clamp(damage.g * 1.5, 0.0, 0.92);
        vec3 scorchedColor = mix(gradedRgb, vec3(0.04, 0.03, 0.03), scorchFactor);

        // World normal & view direction
        vec3 sunDir = normalize(uSunDirection);
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // STAR / SUN RENDERING: Self-luminous thermonuclear body
        if (uIsStar > 0.5) {
          float mu = max(dot(normal, viewDir), 0.0);
          // Solar limb darkening (hot core center, cooler amber limb)
          float limbDarkening = 0.38 + 0.62 * pow(mu, 0.6);

          // Impact damage on the Sun appears as magnetic sunspots (cooling convective umbra)
          vec3 sunspotCol = vec3(0.14, 0.02, 0.01);
          vec3 starRgb = mix(gradedRgb * 1.4, sunspotCol, scorchFactor);
          vec3 starDiffuse = starRgb * limbDarkening;

          // Incandescent flare plasma around magnetic sunspot rims
          if (damage.g > 0.05) {
            starDiffuse += vec3(1.0, 0.88, 0.5) * damage.g * 1.6;
          }

          // Coronal rim glow around solar horizon
          float coronaRim = pow(1.0 - mu, 2.6);
          starDiffuse += vec3(1.0, 0.55, 0.1) * coronaRim * 1.8;

          gl_FragColor = vec4(starDiffuse, 1.0);
          return;
        }

        // Topographic normal map perturbation for realistic mountain ridges & elevation
        if (uHasNormalMap > 0.5) {
          vec3 nTex = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
          vec3 upVec = vec3(0.0, 1.0, 0.0);
          vec3 tangent = normalize(cross(upVec, normal));
          if (length(tangent) < 0.01) tangent = vec3(1.0, 0.0, 0.0);
          vec3 bitangent = cross(normal, tangent);
          normal = normalize(tangent * nTex.x * 0.6 + bitangent * nTex.y * 0.6 + normal * nTex.z);
        }

        // Lighting calculation (day / night terminator)
        float NdotL = dot(normal, sunDir);
        float dayFactor = smoothstep(-0.15, 0.22, NdotL);
        float nightFactor = 1.0 - dayFactor;

        // Diffuse lighting with realistic day-to-night falloff
        vec3 diffuse = scorchedColor * (0.08 + 0.96 * dayFactor);

        // Specular ocean glint: sharp, realistic sun reflection on water (suppressed on scorched crater)
        if (uHasOcean > 0.5) {
          float specMask = texture2D(tSpecular, vUv).r * (1.0 - scorchFactor);
          if (specMask > 0.35) {
            vec3 halfVector = normalize(sunDir + viewDir);
            float NdotH = max(dot(normal, halfVector), 0.0);
            float specular = pow(NdotH, 96.0) * specMask * dayFactor * 0.65;
            diffuse += vec3(1.0, 0.97, 0.90) * specular;
          }
        }

        // Google Earth Rayleigh atmospheric limb haze on surface horizon
        float rim = 1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float limbHaze = pow(rim, 3.2) * dayFactor * 0.42;
        vec3 hazeColor = vec3(0.28, 0.65, 1.0);
        diffuse = mix(diffuse, hazeColor, limbHaze * (uHasOcean > 0.5 ? 0.85 : 0.45));

        // Night side city lights (only on dark hemisphere and where not scorched)
        if (uHasNightLights > 0.5) {
          vec3 nightLights = texture2D(tNight, vUv).rgb;
          float lightMask = nightFactor * (1.0 - scorchFactor);
          diffuse += nightLights * lightMask * 2.2;
        }

        // Realistic subtle warm ember glow inside crater center (clean & natural, no blinding glare)
        float heat = clamp(damage.b, 0.0, 1.0);
        if (heat > 0.1) {
          vec3 magmaOrange = vec3(1.0, 0.38, 0.08);
          diffuse += magmaOrange * heat * 1.2;
        }

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `;

    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        tSurface: { value: options.surfaceMap },
        tNormal: { value: options.normalMap || new THREE.Texture() },
        tSpecular: { value: options.specularMap || new THREE.Texture() },
        tNight: { value: options.nightMap || new THREE.Texture() },
        tDamage: { value: options.damageMap },
        uSunDirection: { value: options.sunDirection.clone() },
        uCoreColor: { value: new THREE.Color(options.coreColor || '#ff4500') },
        uHasOcean: { value: options.hasOcean ? 1.0 : 0.0 },
        uHasNightLights: { value: options.nightMap ? 1.0 : 0.0 },
        uHasNormalMap: { value: options.normalMap ? 1.0 : 0.0 },
        uIsStar: { value: options.isStar ? 1.0 : 0.0 },
      },
    });
  }

  public updateSunDirection(dir: THREE.Vector3): void {
    this.uniforms.uSunDirection.value.copy(dir);
  }
}
