import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveWell {
  group: THREE.Group;
  position: THREE.Vector3;
  coreMesh: THREE.Mesh;
  discMesh: THREE.Mesh;
  duration: number;
  maxDuration: number;
  targetUV: { u: number; v: number };
}

export class GravityWellWeapon extends Weapon {
  private activeWells: ActiveWell[] = [];
  public currentWellPosition: THREE.Vector3 | null = null;

  constructor() {
    super({
      id: 'gravity_well',
      name: 'Gravity Well',
      category: 'celestial',
      description: 'Generates an intense localized gravitational singularity, violently pulling surface crust, atmosphere, and debris into an accretion spiral.',
      cooldownMs: 1200,
      iconName: 'Orbit',
      keyShortcut: '4',
      damageRadius: 0.08,
      damageIntensity: 0.75,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    // Position singularity slightly above the target surface
    const wellPos = target.point.clone().addScaledVector(target.normal, 0.8);

    const group = new THREE.Group();
    group.position.copy(wellPos);

    // Dark singularity core
    const coreGeo = new THREE.SphereGeometry(0.22, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x050010 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Glowing accretion ring with smooth radial gradient
    const discGeo = new THREE.RingGeometry(0.24, 0.85, 48);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vLocalPos;
        void main() {
          float r = length(vLocalPos.xy);
          float t = (r - 0.24) / (0.85 - 0.24);
          float edgeAlpha = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.7, t);
          vec3 col = mix(vec3(0.9, 0.7, 1.0), vec3(0.5, 0.1, 0.9), t);
          gl_FragColor = vec4(col, edgeAlpha * 0.85);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    group.add(discMesh);

    context.scene.add(group);

    this.activeWells.push({
      group,
      position: wellPos,
      coreMesh,
      discMesh,
      duration: 0,
      maxDuration: 4.5, // Active for 4.5s
      targetUV: { ...target.uv },
    });

    // Tidal crush damage
    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      lat: target.lat,
      lon: target.lon,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 0.6,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(target.point, target.normal, 1.2, '#aa44ff');
    context.cameraController.addTrauma(0.4);
    context.audioManager.playGravityPulse();
  }

  public update(delta: number, context: WeaponContext): void {
    this.currentWellPosition = null;

    for (let i = this.activeWells.length - 1; i >= 0; i--) {
      const well = this.activeWells[i];
      well.duration += delta;

      if (well.duration >= well.maxDuration) {
        // Implosion at end
        context.shockwaveSystem.create(well.position, new THREE.Vector3(0, 1, 0), 1.8, '#dd66ff');
        context.particleSystem.emit(well.position, new THREE.Vector3(0, 1, 0), 40, '#aa44ff', 1.5, 4.0, 1.0, 1.0);
        context.scene.remove(well.group);
        disposeNode(well.group);
        this.activeWells.splice(i, 1);
        continue;
      }

      this.currentWellPosition = well.position;

      // Spin accretion ring
      well.discMesh.rotation.z += delta * 7.0;
      const pulse = 1.0 + Math.sin(well.duration * 8.0) * 0.15;
      well.coreMesh.scale.set(pulse, pulse, pulse);

      // Periodically pull particles and spawn inward suction embers
      if (Math.random() < 0.35) {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0
        );
        const spawnPos = well.position.clone().add(offset);
        const pullDir = well.position.clone().sub(spawnPos).normalize();
        context.particleSystem.emit(spawnPos, pullDir, 4, '#bb55ff', 1.0, 3.0, 0.6, 0.2);
      }
    }
  }

  public dispose(): void {
    for (const well of this.activeWells) {
      disposeNode(well.group);
    }
    this.activeWells = [];
    this.currentWellPosition = null;
  }
}
