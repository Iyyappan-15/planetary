import * as THREE from 'three';
import { PlanetConfig, ImpactData } from '../types/planet';
import { PlanetIntegrity } from '../types/game';
import { ProceduralTextures } from '../utils/textures';
import { PlanetMaterial } from './PlanetMaterial';
import { Atmosphere } from './Atmosphere';
import { CloudLayer } from './CloudLayer';
import { DamageSystem } from './DamageSystem';
import { FractureSystem } from './FractureSystem';
import { PopulationSystem } from './PopulationSystem';
import { ShieldSystem, ShieldContext } from './ShieldSystem';
import { ShieldType, ActiveShieldState } from '../types/shield';
import { disposeNode } from '../utils/disposal';

export class Planet {
  public group: THREE.Group;
  public config: PlanetConfig;
  public surfaceMesh: THREE.Mesh;
  public atmosphere: Atmosphere | null = null;
  public clouds: CloudLayer | null = null;
  public ringMesh: THREE.Mesh | null = null;

  public damageSystem: DamageSystem;
  public fractureSystem: FractureSystem;
  public populationSystem: PopulationSystem;
  public shieldSystem: ShieldSystem;
  public shieldContext: ShieldContext | null = null;
  private onShieldStateChange?: (state: ActiveShieldState | null) => void;

  private material: PlanetMaterial;
  private surfaceTexture: THREE.Texture;
  private normalTexture: THREE.Texture | null = null;
  private specularTexture: THREE.Texture | null = null;
  private nightTexture: THREE.Texture | null = null;
  private ringTexture: THREE.Texture | null = null;

  public isDestroyed: boolean = false;
  public isRotationPaused: boolean = false;

  constructor(config: PlanetConfig, sunDirection: THREE.Vector3, onShieldChange?: (state: ActiveShieldState | null) => void) {
    this.config = config;
    this.group = new THREE.Group();
    this.onShieldStateChange = onShieldChange;

    // 1. Initialize Damage, Fracture, Population, and Shield systems
    this.damageSystem = new DamageSystem(1024, 512);
    this.fractureSystem = new FractureSystem(config.radius, config.destruction.coreColor);
    this.group.add(this.fractureSystem.group);
    this.populationSystem = new PopulationSystem(config.id, config.initialPopulation);
    this.shieldSystem = new ShieldSystem(config.radius, (state) => this.onShieldStateChange?.(state));

    const isEarth = config.id === 'earth';

    // 2. Texture initialization: Real NASA Blue Marble for Earth, procedural for others
    if (isEarth) {
      const loader = new THREE.TextureLoader();
      this.surfaceTexture = loader.load('./earth_day.jpg');
      this.surfaceTexture.colorSpace = THREE.SRGBColorSpace;
      this.surfaceTexture.wrapS = THREE.RepeatWrapping;
      this.surfaceTexture.wrapT = THREE.ClampToEdgeWrapping;

      this.normalTexture = loader.load('./earth_normal.jpg');
      this.normalTexture.wrapS = THREE.RepeatWrapping;
      this.normalTexture.wrapT = THREE.ClampToEdgeWrapping;

      this.specularTexture = loader.load('./earth_specular.jpg');
      this.specularTexture.wrapS = THREE.RepeatWrapping;
      this.specularTexture.wrapT = THREE.ClampToEdgeWrapping;

      this.nightTexture = loader.load('./earth_lights.png');
      this.nightTexture.wrapS = THREE.RepeatWrapping;
      this.nightTexture.wrapT = THREE.ClampToEdgeWrapping;
    } else {
      this.surfaceTexture = ProceduralTextures.createSurfaceTexture(config.surface, 1024, 512);

      if (config.surface.hasOcean) {
        this.specularTexture = ProceduralTextures.createEarthSpecularTexture(512, 256);
      }
      if (config.surface.hasCityLights) {
        this.nightTexture = ProceduralTextures.createEarthNightLightsTexture(512, 256);
      }
    }

    // 3. Create Cloud Layer if configured (so texture is available for surface cloud shadows)
    if (config.clouds?.enabled) {
      this.clouds = new CloudLayer(config.radius, config.clouds, isEarth);
      this.group.add(this.clouds.mesh);
    }

    // 4. Create Planet Surface Mesh
    const sphereGeo = new THREE.SphereGeometry(config.radius, 64, 64);
    this.material = new PlanetMaterial({
      surfaceMap: this.surfaceTexture,
      normalMap: this.normalTexture,
      specularMap: this.specularTexture,
      nightMap: this.nightTexture,
      damageMap: this.damageSystem.damageTexture,
      sunDirection,
      coreColor: config.destruction.coreColor,
      hasOcean: config.surface.hasOcean,
      isStar: config.isStar || config.surface.type === 'star',
    });

    this.surfaceMesh = new THREE.Mesh(sphereGeo, this.material);
    this.group.add(this.surfaceMesh);

    // 5. Create Atmosphere if enabled
    if (config.atmosphere.enabled) {
      this.atmosphere = new Atmosphere(config.radius, config.atmosphere, sunDirection);
      this.group.add(this.atmosphere.mesh);
    }

    // 6. Create Planetary Rings if configured (e.g. Saturn)
    if (config.rings?.enabled) {
      this.createRings(config.rings, sunDirection);
    }
  }

  private ringMaterial: THREE.ShaderMaterial | null = null;

  private createRings(ringConfig: NonNullable<PlanetConfig['rings']>, sunDirection: THREE.Vector3): void {
    // High-polygon ring geometry with theta and radial subdivisions
    const geometry = new THREE.RingGeometry(ringConfig.innerRadius, ringConfig.outerRadius, 128, 8);

    // Recompute UV coordinates so that 'u' is radial distance from inner to outer edge
    // This allows the concentric ring texture to map perfectly in circles without planar distortion
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const r = Math.hypot(x, y);
      const u = (r - ringConfig.innerRadius) / (ringConfig.outerRadius - ringConfig.innerRadius);
      const theta = Math.atan2(y, x);
      const v = theta / (Math.PI * 2) + 0.5;
      uvAttr.setXY(i, u, v);
    }
    uvAttr.needsUpdate = true;

    // Rotate geometry to horizontal orbital plane
    geometry.rotateX(-Math.PI / 2);

    this.ringTexture = ProceduralTextures.createRingTexture(1024, 64);

    // Dedicated Saturn Ring shader with luminous two-sided forward/back scattering and planetary shadow
    this.ringMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tRing: { value: this.ringTexture },
        uSunDirection: { value: sunDirection.clone() },
        uOpacity: { value: ringConfig.opacity },
        uPlanetRadius: { value: this.config.radius },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D tRing;
        uniform vec3 uSunDirection;
        uniform float uOpacity;
        uniform float uPlanetRadius;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          vec4 ringSample = texture2D(tRing, vec2(vUv.x, 0.5));
          if (ringSample.a < 0.01) discard;

          vec3 sunDir = normalize(uSunDirection);
          vec3 normal = normalize(vWorldNormal);

          // Bilateral light transmission: icy ring particles scatter intensely from both sides
          float nDotL = abs(dot(normal, sunDir));
          float illum = 0.52 + 0.48 * nDotL;

          // Planetary shadow: Saturn casts a cylindrical shadow away from the sun onto the rings
          float proj = dot(vWorldPos, -sunDir);
          if (proj > 0.0) {
            vec3 shadowAxisPoint = -sunDir * proj;
            float distFromAxis = length(vWorldPos - shadowAxisPoint);
            if (distFromAxis < uPlanetRadius * 1.04) {
              float penumbra = smoothstep(uPlanetRadius * 0.94, uPlanetRadius * 1.04, distFromAxis);
              illum *= (0.12 + 0.88 * penumbra);
            }
          }

          // Rich, brilliant golden-ice radiance
          vec3 col = ringSample.rgb * illum * 1.3;
          float alpha = ringSample.a * uOpacity;

          gl_FragColor = vec4(col, alpha);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });

    this.ringMesh = new THREE.Mesh(geometry, this.ringMaterial);
    // Real Saturn axial tilt (~26.7 degrees)
    this.ringMesh.rotation.z = 0.466;
    this.ringMesh.rotation.x = 0.12;
    this.group.add(this.ringMesh);
  }

  public setShieldContext(context: ShieldContext): void {
    this.shieldContext = context;
  }

  public deployShield(type: ShieldType): void {
    if (this.shieldContext) {
      this.shieldSystem.deploy(type, this.shieldContext);
    }
  }

  public removeShield(): void {
    if (this.shieldContext) {
      this.shieldSystem.remove(this.shieldContext.scene);
    }
  }

  public registerImpact(impact: ImpactData): void {
    // 1. If planetary shield is active, it intercepts the hit and absorbs damage
    if (this.shieldSystem.isActive && this.shieldContext) {
      const absorbed = this.shieldSystem.absorbImpact(impact, this.shieldContext);
      if (absorbed) {
        // Shield successfully deflected the attack: 0 crust damage, 0 population casualties!
        return;
      }
    }

    this.damageSystem.registerImpact(impact);
    this.populationSystem.registerImpactCasualties(impact, false);

    if (this.atmosphere) {
      this.atmosphere.setDisturbance(impact.intensity * 0.8);
    }

    const integrity = this.getIntegrity();
    // Catastrophic destruction threshold
    if (integrity.percentage <= 25 && !this.isDestroyed) {
      this.triggerBreakup(impact.position);
    }
  }

  public triggerBreakup(epicenter?: THREE.Vector3): void {
    this.isDestroyed = true;
    this.surfaceMesh.visible = false;
    if (this.clouds) this.clouds.setVisible(false);
    if (this.atmosphere) this.atmosphere.setVisible(false);
    if (this.ringMesh) this.ringMesh.visible = false;
    if (this.shieldContext) this.shieldSystem.remove(this.shieldContext.scene);
    this.populationSystem.registerImpactCasualties({} as ImpactData, true);
    this.fractureSystem.triggerBreakup(epicenter);
  }

  public update(delta: number, sunDirection: THREE.Vector3, gravityWellPos?: THREE.Vector3 | null): void {
    // Planet axial rotation
    if (!this.isDestroyed) {
      if (!this.isRotationPaused) {
        this.surfaceMesh.rotation.y += this.config.rotationSpeed * delta;
        if (this.clouds) {
          this.clouds.update(delta);
        }
      }
      if (this.atmosphere) {
        this.atmosphere.update(delta, sunDirection);
      }
    }

    this.shieldSystem.update(delta);

    this.material.updateSunDirection(sunDirection);
    if (this.ringMaterial) {
      this.ringMaterial.uniforms.uSunDirection.value.copy(sunDirection);
    }
    this.fractureSystem.update(delta, gravityWellPos);
  }

  public getIntegrity(): PlanetIntegrity {
    const percentage = this.damageSystem.getIntegrityPercentage(this.config.destruction.resistance);
    return {
      currentHp: percentage,
      maxHp: 100,
      percentage,
      isBroken: this.isDestroyed,
      impactCount: this.damageSystem.impactCount,
      population: this.populationSystem.getState(),
    };
  }

  public reset(): void {
    this.isDestroyed = false;
    this.surfaceMesh.visible = true;
    if (this.clouds) this.clouds.setVisible(true);
    if (this.atmosphere) this.atmosphere.setVisible(true);
    if (this.ringMesh) this.ringMesh.visible = true;

    if (this.shieldContext) {
      this.shieldSystem.remove(this.shieldContext.scene);
    }

    this.damageSystem.reset();
    this.fractureSystem.reset();
    this.populationSystem.reset();
  }

  public setAtmosphereVisible(visible: boolean): void {
    if (this.atmosphere) {
      this.atmosphere.setVisible(visible && !this.isDestroyed);
    }
  }

  public setCloudsVisible(visible: boolean): void {
    if (this.clouds) {
      this.clouds.setVisible(visible && !this.isDestroyed);
    }
  }

  public dispose(): void {
    if (this.shieldContext) {
      this.shieldSystem.dispose(this.shieldContext.scene);
    }
    this.damageSystem.dispose();
    this.fractureSystem.dispose();
    if (this.atmosphere) this.atmosphere.dispose();
    if (this.clouds) this.clouds.dispose();
    if (this.ringMesh) disposeNode(this.ringMesh);
    if (this.ringMaterial) this.ringMaterial.dispose();

    this.surfaceTexture.dispose();
    if (this.normalTexture) this.normalTexture.dispose();
    if (this.specularTexture) this.specularTexture.dispose();
    if (this.nightTexture) this.nightTexture.dispose();
    if (this.ringTexture) this.ringTexture.dispose();

    disposeNode(this.surfaceMesh);
    disposeNode(this.group);
  }
}
