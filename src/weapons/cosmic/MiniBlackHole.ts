import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveHole {
  group: THREE.Group;
  position: THREE.Vector3;
  duration: number;
  maxDuration: number;
  diskMat: THREE.ShaderMaterial;
  lensMat: THREE.ShaderMaterial;
}

export class MiniBlackHoleWeapon extends Weapon {
  private holes: ActiveHole[] = [];

  constructor() {
    super({
      id: 'black_hole',
      name: 'Black Hole',
      category: 'celestial',
      description: 'Cosmic singularity with an intense gravitational gradient that tears matter apart and swallows planetary crust.',
      cooldownMs: 2400,
      iconName: 'Disc',
      keyShortcut: '7',
      damageRadius: 0.22,
      damageIntensity: 1.5,
    });
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const holePos = target.point.clone().addScaledVector(target.normal, 1.3);
    const group = new THREE.Group();
    group.position.copy(holePos);

    // 1. Absolute Black Event Horizon
    const sphereGeo = new THREE.SphereGeometry(0.32, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
    });
    const core = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(core);

    // 2. Razor-sharp Photon Sphere (inner boundary)
    const photonGeo = new THREE.RingGeometry(0.32, 0.36, 64);
    const photonMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const photonRing = new THREE.Mesh(photonGeo, photonMat);
    photonRing.rotateX(Math.PI * 0.45);
    group.add(photonRing);

    // 3. Cinematic Relativistic Accretion Disk Shader
    const diskMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uInnerRadius: { value: 0.34 },
        uOuterRadius: { value: 1.35 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vLocalPos;
        void main() {
          vUv = uv;
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        varying vec2 vUv;
        varying vec3 vLocalPos;

        void main() {
          float r = length(vLocalPos.xy);
          if (r < uInnerRadius || r > uOuterRadius) {
            discard;
          }

          // Normalized distance across disk (0.0 at inner edge, 1.0 at outer edge)
          float t = (r - uInnerRadius) / (uOuterRadius - uInnerRadius);

          // Doppler Beaming asymmetry: gas moving towards view is relativistic blue/brighter
          float angle = atan(vLocalPos.y, vLocalPos.x);
          // Differential Keplerian rotation: inner disk spins faster
          float rotation = uTime * (1.5 / sqrt(r));
          float spiral = sin(angle * 3.0 + rotation + r * 8.0) * 0.15 + 0.85;

          // Relativistic brightness boost on one side
          float doppler = 0.8 + 0.4 * cos(angle + 0.8);

          // Radial color temperature gradient:
          // Inner: Blinding white-blue relativistic thermal radiation
          // Mid: Fierce interstellar orange-gold
          // Outer: Deep crimson fading to cosmic dark
          vec3 innerCol = vec3(1.0, 0.98, 0.92);
          vec3 midCol = vec3(1.0, 0.48, 0.08);
          vec3 outerCol = vec3(0.65, 0.08, 0.02);

          vec3 col = t < 0.25 
            ? mix(innerCol, midCol, t / 0.25)
            : mix(midCol, outerCol, (t - 0.25) / 0.75);

          // Alpha falloff at boundaries for soft realistic edges
          float edgeAlpha = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.65, t);
          float alpha = clamp(edgeAlpha * spiral * doppler * 0.95, 0.0, 1.0);

          gl_FragColor = vec4(col * (1.0 + (1.0 - t) * 1.5), alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const diskGeo = new THREE.RingGeometry(0.34, 1.35, 64);
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotateX(Math.PI * 0.45);
    group.add(disk);

    // 4. Gravitational Lensing Halo (Interstellar curved light effect)
    const lensMat = diskMat.clone();
    const lensRing = new THREE.Mesh(diskGeo, lensMat);
    lensRing.rotateY(Math.PI * 0.15);
    lensRing.scale.set(0.85, 0.85, 0.85);
    group.add(lensRing);

    context.scene.add(group);

    this.holes.push({
      group,
      position: holePos,
      duration: 0,
      maxDuration: 6.0,
      diskMat,
      lensMat,
    });

    // Massive damage
    context.planet.registerImpact({
      u: target.uv.u,
      v: target.uv.v,
      lat: target.lat,
      lon: target.lon,
      position: target.point,
      radius: this.config.damageRadius,
      intensity: this.config.damageIntensity,
      heat: 1.0,
      timestamp: performance.now(),
    });

    // Supersonic vacuum shockwave
    context.shockwaveSystem.create(target.point, target.normal, context.planet.config.radius * 0.6, '#ff4400');
    context.cameraController.addTrauma(0.65);
    context.audioManager.playGravityPulse();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i];
      h.duration += delta;

      if (h.duration >= h.maxDuration) {
        context.scene.remove(h.group);
        disposeNode(h.group);
        this.holes.splice(i, 1);
        continue;
      }

      // Update shader uniforms
      h.diskMat.uniforms.uTime.value = h.duration;
      h.lensMat.uniforms.uTime.value = h.duration;

      // Axial rotation
      h.group.rotation.y += delta * 1.5;

      // Inward logarithmic gravitational spiral vortex
      if (Math.random() < 0.6) {
        // Spawn particle at outer perimeter
        const orbitAngle = Math.random() * Math.PI * 2;
        const orbitRadius = 1.2 + Math.random() * 1.5;
        const spawn = h.position.clone().add(
          new THREE.Vector3(
            Math.cos(orbitAngle) * orbitRadius,
            (Math.random() - 0.5) * 0.6,
            Math.sin(orbitAngle) * orbitRadius
          )
        );

        // Vector pointing inward toward singularity + tangential orbital velocity
        const toCenter = h.position.clone().sub(spawn).normalize();
        const tangent = new THREE.Vector3(-toCenter.z, 0, toCenter.x).normalize();
        const spiralDir = toCenter.multiplyScalar(0.7).add(tangent.multiplyScalar(0.3)).normalize();

        context.particleSystem.emit(
          spawn,
          spiralDir,
          4,
          Math.random() > 0.5 ? '#ffaa33' : '#ff4411',
          1.2,
          5.5,
          0.8,
          0.1
        );
      }
    }
  }

  public dispose(): void {
    for (const h of this.holes) {
      disposeNode(h.group);
    }
    this.holes = [];
  }
}
