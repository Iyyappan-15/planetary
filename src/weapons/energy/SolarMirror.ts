import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveMirror {
  mirrorGroup: THREE.Group;
  petals: THREE.Mesh[];
  beam: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
}

export class SolarMirrorWeapon extends Weapon {
  private activeMirrors: ActiveMirror[] = [];

  constructor() {
    super({
      id: 'solar_mirror',
      name: 'Solar Mirror',
      category: 'lasers',
      description: 'Massive orbital mirror focuses raw solar radiation into an incinerating death ray that vaporizes oceans and crust.',
      cooldownMs: 2200,
      iconName: 'Sun',
      damageRadius: 0.13,
      damageIntensity: 1.25,
    });
  }

  private createMirrorMesh(): { group: THREE.Group; petals: THREE.Mesh[]; beam: THREE.Mesh } {
    const group = new THREE.Group();
    const petals: THREE.Mesh[] = [];

    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.98,
      roughness: 0.05,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.8,
    });

    // Central hub
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 12);
    const hub = new THREE.Mesh(hubGeo, goldMat);
    hub.rotation.x = Math.PI / 2;
    group.add(hub);

    // 6 Folding Mirror Petals
    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2;
      const petalGeo = new THREE.CircleGeometry(0.45, 16, 0, Math.PI / 3);
      const petal = new THREE.Mesh(petalGeo, mirrorMat);
      petal.position.set(Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0);
      petal.rotation.z = angle;
      group.add(petal);
      petals.push(petal);
    }

    // Solar Laser Beam
    const beamGeo = new THREE.CylinderGeometry(0.04, 0.15, 1, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.visible = false;
    group.add(beam);

    return { group, petals, beam };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const altitude = context.planet.config.radius + 2.4;
    const mirrorPos = target.normal.clone().multiplyScalar(altitude);
    const { group, petals, beam } = this.createMirrorMesh();
    group.position.copy(mirrorPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activeMirrors.push({
      mirrorGroup: group,
      petals,
      beam,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 5.5,
    });

    context.audioManager.playSolarMirrorBurn();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeMirrors.length - 1; i >= 0; i--) {
      const m = this.activeMirrors[i];
      m.timer += delta;
      m.mirrorGroup.rotation.z += delta * 0.8;

      // Phase 1: Mirror petals unfold (0.0 -> 1.0s)
      if (m.timer < 1.0) {
        const unfoldT = m.timer / 1.0;
        for (const p of m.petals) {
          p.scale.set(unfoldT, unfoldT, 1);
        }
      } else if (m.timer < 4.5) {
        // Phase 2: Sustained solar death beam firing
        m.beam.visible = true;
        const dist = m.mirrorGroup.position.distanceTo(m.targetPos);
        m.beam.position.set(0, 0, dist * 0.5);
        m.beam.scale.set(1, dist, 1);
        m.beam.rotation.x = Math.PI / 2;

        // Ground incineration
        if (Math.random() < 0.25) {
          const local = m.targetPos.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: m.targetPos,
            radius: 0.04,
            intensity: 0.65,
            heat: 1.0,
            timestamp: performance.now(),
            type: 'laser',
          });

          context.particleSystem.emit(m.targetPos, m.targetNormal, 8, '#ffcc00', 0.5, 2.0, 0.4, 0.2);
        }
      } else {
        // Phase 3: Fold back up and fade
        m.beam.visible = false;
        const foldT = Math.max(0, (m.duration - m.timer) / 1.0);
        m.mirrorGroup.scale.set(foldT, foldT, foldT);
      }

      if (m.timer >= m.duration) {
        context.scene.remove(m.mirrorGroup);
        disposeNode(m.mirrorGroup);
        this.activeMirrors.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const m of this.activeMirrors) {
      disposeNode(m.mirrorGroup);
    }
    this.activeMirrors = [];
  }
}
