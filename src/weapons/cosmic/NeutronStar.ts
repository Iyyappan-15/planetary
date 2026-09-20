import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveNeutron {
  group: THREE.Group;
  core: THREE.Mesh;
  polarJets: THREE.Mesh[];
  path: THREE.CatmullRomCurve3;
  targetPoint: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
  hasPulled: boolean;
}

export class NeutronStarWeapon extends Weapon {
  private activeNeutrons: ActiveNeutron[] = [];

  constructor() {
    super({
      id: 'neutron_star',
      name: 'Neutron Star',
      category: 'celestial',
      description: 'Hyper-dense city-sized neutron star sweeps in close flyby, tearing off crust with extreme tidal gravity and pulsar jets.',
      cooldownMs: 3400,
      iconName: 'Radio',
      damageRadius: 0.28,
      damageIntensity: 2.4,
    });
  }

  private createNeutronMesh(): { group: THREE.Group; core: THREE.Mesh; polarJets: THREE.Mesh[] } {
    const group = new THREE.Group();

    // 1. Ultra-dense incandescent core
    const coreGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xddf0ff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Magnetic field rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x5599ff,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    for (let r = 0; r < 2; r++) {
      const ringGeo = new THREE.TorusGeometry(0.65 + r * 0.25, 0.02, 8, 32);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = r * 0.8;
      group.add(ring);
    }

    // 2. Relativistic Polar Beams / Pulsar Jets
    const polarJets: THREE.Mesh[] = [];
    const jetGeo = new THREE.CylinderGeometry(0.04, 0.4, 4.0, 16);
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    northJet.position.y = 2.0;
    group.add(northJet);
    polarJets.push(northJet);

    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.position.y = -2.0;
    southJet.rotation.x = Math.PI;
    group.add(southJet);
    polarJets.push(southJet);

    return { group, core, polarJets };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(target.normal, up).normalize();

    // Hyperbolic flyby path grazing the target location
    const periapsis = target.point.clone().addScaledVector(target.normal, 1.2);
    const startPoint = periapsis.clone().addScaledVector(side, -10.0).addScaledVector(target.normal, 4.0);
    const endPoint = periapsis.clone().addScaledVector(side, 10.0).addScaledVector(target.normal, 4.0);

    const curve = new THREE.CatmullRomCurve3([startPoint, periapsis, endPoint]);

    const { group, core, polarJets } = this.createNeutronMesh();
    group.position.copy(startPoint);
    context.scene.add(group);

    this.activeNeutrons.push({
      group,
      core,
      polarJets,
      path: curve,
      targetPoint: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 5.5,
      hasPulled: false,
    });

    context.audioManager.playNeutronStarPulsar();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeNeutrons.length - 1; i >= 0; i--) {
      const n = this.activeNeutrons[i];
      n.timer += delta;

      const progress = Math.min(1.0, n.timer / 4.5);
      const pt = n.path.getPointAt(progress);
      n.group.position.copy(pt);

      // Rapid pulsar rotation
      n.group.rotation.y += delta * 18.0;
      n.group.rotation.x += delta * 12.0;

      // Pulsar radiation particles
      context.particleSystem.emit(
        n.group.position,
        n.targetNormal,
        3,
        '#88ccff',
        0.4,
        1.5,
        0.3,
        0.2
      );

      // Closest approach (progress ~ 0.5)
      if (progress >= 0.5 && !n.hasPulled) {
        n.hasPulled = true;

        context.planet.registerImpact({
          u: 0.5,
          v: 0.5,
          position: n.targetPoint,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 0.9,
          timestamp: performance.now(),
        });

        context.shockwaveSystem.create(n.targetPoint, n.targetNormal, context.planet.config.radius * 1.4, '#aaccff');
        context.particleSystem.emit(n.targetPoint, n.targetNormal, 90, '#aaccff', 2.5, 6.0, 1.8, 0.9);
        context.cameraController.addTrauma(0.8);
      }

      if (n.timer >= n.duration) {
        context.scene.remove(n.group);
        disposeNode(n.group);
        this.activeNeutrons.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const n of this.activeNeutrons) {
      disposeNode(n.group);
    }
    this.activeNeutrons = [];
  }
}
