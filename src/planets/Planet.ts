import * as THREE from 'three';
import { PlanetConfig, ImpactData } from '../types/planet';
import { PlanetIntegrity } from '../types/game';
import { ProceduralTextures } from '../utils/textures';
import { PlanetMaterial } from './PlanetMaterial';
import { Atmosphere } from './Atmosphere';
import { CloudLayer } from './CloudLayer';
import { DamageSystem } from './DamageSystem';
import { FractureSystem } from './FractureSystem';
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

  private material: PlanetMaterial;
  private surfaceTexture: THREE.CanvasTexture;
  private specularTexture: THREE.CanvasTexture | null = null;
  private nightTexture: THREE.CanvasTexture | null = null;
  private ringTexture: THREE.CanvasTexture | null = null;

  public isDestroyed: boolean = false;

  constructor(config: PlanetConfig, sunDirection: THREE.Vector3) {
    this.config = config;
    this.group = new THREE.Group();

    // 1. Initialize Damage and Fracture systems
    this.damageSystem = new DamageSystem(1024, 512);
    this.fractureSystem = new FractureSystem(config.radius, config.destruction.coreColor);
    this.group.add(this.fractureSystem.group);

    // 2. Generate procedural textures based on configuration
    this.surfaceTexture = ProceduralTextures.createSurfaceTexture(config.surface, 1024, 512);

    if (config.surface.hasOcean) {
      this.specularTexture = ProceduralTextures.createEarthSpecularTexture(512, 256);
    }
    if (config.surface.hasCityLights) {
      this.nightTexture = ProceduralTextures.createEarthNightLightsTexture(512, 256);
    }

    // 3. Create Planet Surface Mesh
    const sphereGeo = new THREE.SphereGeometry(config.radius, 64, 64);
    this.material = new PlanetMaterial({
      surfaceMap: this.surfaceTexture,
      specularMap: this.specularTexture,
      nightMap: this.nightTexture,
      damageMap: this.damageSystem.damageTexture,
      sunDirection,
      coreColor: config.destruction.coreColor,
      hasOcean: config.surface.hasOcean,
    });

    this.surfaceMesh = new THREE.Mesh(sphereGeo, this.material);
    this.group.add(this.surfaceMesh);

    // 4. Create Atmosphere if enabled
    if (config.atmosphere.enabled) {
      this.atmosphere = new Atmosphere(config.radius, config.atmosphere, sunDirection);
      this.group.add(this.atmosphere.mesh);
    }

    // 5. Create Cloud Layer if configured
    if (config.clouds?.enabled) {
      this.clouds = new CloudLayer(config.radius, config.clouds);
      this.group.add(this.clouds.mesh);
    }

    // 6. Create Planetary Rings if configured (e.g. Saturn)
    if (config.rings?.enabled) {
      this.createRings(config.rings);
    }
  }

  private createRings(ringConfig: NonNullable<PlanetConfig['rings']>): void {
    const geometry = new THREE.RingGeometry(ringConfig.innerRadius, ringConfig.outerRadius, 64);
    // Rotate geometry to horizontal plane
    geometry.rotateX(-Math.PI / 2);

    this.ringTexture = ProceduralTextures.createRingTexture(512, 64);
    const material = new THREE.MeshStandardMaterial({
      map: this.ringTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: ringConfig.opacity,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.ringMesh = new THREE.Mesh(geometry, material);
    // Subtle tilt for realism
    this.ringMesh.rotation.z = 0.45;
    this.group.add(this.ringMesh);
  }

  public registerImpact(impact: ImpactData): void {
    this.damageSystem.registerImpact(impact);

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
    this.fractureSystem.triggerBreakup(epicenter);
  }

  public update(delta: number, sunDirection: THREE.Vector3, gravityWellPos?: THREE.Vector3 | null): void {
    // Planet axial rotation
    if (!this.isDestroyed) {
      this.surfaceMesh.rotation.y += this.config.rotationSpeed * delta;
      if (this.clouds) {
        this.clouds.update(delta);
      }
      if (this.atmosphere) {
        this.atmosphere.update(delta, sunDirection);
      }
    }

    this.material.updateSunDirection(sunDirection);
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
    };
  }

  public reset(): void {
    this.isDestroyed = false;
    this.surfaceMesh.visible = true;
    if (this.clouds) this.clouds.setVisible(true);
    if (this.atmosphere) this.atmosphere.setVisible(true);

    this.damageSystem.reset();
    this.fractureSystem.reset();
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
    this.damageSystem.dispose();
    this.fractureSystem.dispose();
    if (this.atmosphere) this.atmosphere.dispose();
    if (this.clouds) this.clouds.dispose();
    if (this.ringMesh) disposeNode(this.ringMesh);

    this.surfaceTexture.dispose();
    if (this.specularTexture) this.specularTexture.dispose();
    if (this.nightTexture) this.nightTexture.dispose();
    if (this.ringTexture) this.ringTexture.dispose();

    disposeNode(this.surfaceMesh);
    disposeNode(this.group);
  }
}
