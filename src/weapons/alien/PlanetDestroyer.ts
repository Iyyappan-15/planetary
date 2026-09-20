import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveDestroyer {
  satelliteGroup: THREE.Group;
  tributaryLines: THREE.Line[];
  mainBeam: THREE.Mesh;
  targetNormal: THREE.Vector3;
  targetPoint: THREE.Vector3;
  satellitePos: THREE.Vector3;
  timer: number;
  stage: 'charging' | 'firing' | 'receding';
}

export class PlanetDestroyerWeapon extends Weapon {
  private activeDestroyers: ActiveDestroyer[] = [];

  constructor() {
    super({
      id: 'planet_destroyer',
      name: 'Planet Destroyer',
      category: 'alien',
      description: 'Orbital superweapon that charges 8 converging tributary lasers into a massive core-piercing superbeam.',
      cooldownMs: 3500,
      iconName: 'Crosshair',
      damageRadius: 0.25,
      damageIntensity: 2.5,
    });
  }

  private createSuperweaponMesh(): { group: THREE.Group; tributaryLines: THREE.Line[]; mainBeam: THREE.Mesh } {
    const group = new THREE.Group();

    // Central emitter ring structure
    const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      metalness: 0.95,
      roughness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // 4 peripheral capacitor pylons
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pylonGeo = new THREE.BoxGeometry(0.08, 0.08, 0.7);
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x223355, metalness: 0.9 });
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(Math.cos(angle) * 0.75, Math.sin(angle) * 0.75, 0.2);
      group.add(pylon);
    }

    // 8 Converging tributary charge lines
    const tributaryLines: THREE.Line[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const startPt = new THREE.Vector3(Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, 0.3);
      const endPt = new THREE.Vector3(0, 0, -0.1);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([startPt, endPt]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.0,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);
      tributaryLines.push(line);
    }

    // Main titanic core-piercing beam
    const beamGeo = new THREE.CylinderGeometry(0.18, 0.22, 1, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const mainBeam = new THREE.Mesh(beamGeo, beamMat);
    mainBeam.visible = false;
    group.add(mainBeam);

    return { group, tributaryLines, mainBeam };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const satAltitude = context.planet.config.radius + 3.2;
    const satPos = target.normal.clone().multiplyScalar(satAltitude);

    const { group, tributaryLines, mainBeam } = this.createSuperweaponMesh();
    group.position.copy(satPos);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), target.normal.clone().negate());
    context.scene.add(group);

    this.activeDestroyers.push({
      satelliteGroup: group,
      tributaryLines,
      mainBeam,
      targetNormal: target.normal.clone(),
      targetPoint: target.point.clone(),
      satellitePos: satPos,
      timer: 0,
      stage: 'charging',
    });

    context.audioManager.playPlanetDestroyerCharge();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeDestroyers.length - 1; i >= 0; i--) {
      const d = this.activeDestroyers[i];
      d.timer += delta;
      d.satelliteGroup.rotation.z += delta * 1.5;

      if (d.stage === 'charging') {
        // Pulse converging tributary lines
        const chargeProgress = Math.min(1.0, d.timer / 1.6);
        for (const line of d.tributaryLines) {
          (line.material as THREE.LineBasicMaterial).opacity = chargeProgress * (0.5 + Math.sin(d.timer * 30.0) * 0.5);
        }

        // Concentrating energy sparks at focus
        context.particleSystem.emit(
          d.satellitePos.clone().addScaledVector(d.targetNormal, -0.2),
          d.targetNormal,
          2,
          '#00ffcc',
          0.2,
          0.8,
          0.3,
          0.15
        );

        if (d.timer >= 1.7) {
          d.stage = 'firing';
          d.timer = 0;
          context.audioManager.playPlanetDestroyerFire();
        }
      } else if (d.stage === 'firing') {
        const fireProgress = Math.min(1.0, d.timer / 1.4);

        // Position & scale main beam through the planet center
        const beamDist = d.satellitePos.distanceTo(d.targetPoint) + context.planet.config.radius * 1.8;
        d.mainBeam.visible = true;
        d.mainBeam.position.set(0, 0, -beamDist * 0.5);
        d.mainBeam.scale.set(1, beamDist, 1);
        d.mainBeam.rotation.x = Math.PI / 2;

        const beamMat = d.mainBeam.material as THREE.MeshBasicMaterial;
        beamMat.opacity = Math.sin(fireProgress * Math.PI) * 0.95;

        // Devastating damage to surface and core
        context.planet.registerImpact({
          u: 0.5,
          v: 0.5,
          position: d.targetPoint,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 1.0,
          timestamp: performance.now(),
        });

        context.shockwaveSystem.create(d.targetPoint, d.targetNormal, context.planet.config.radius * 0.8, '#00ffff');
        context.particleSystem.emit(d.targetPoint, d.targetNormal, 40, '#00ffcc', 2.5, 6.0, 1.8, 0.9);
        context.cameraController.addTrauma(0.5);

        if (d.timer >= 1.5) {
          d.stage = 'receding';
          d.timer = 0;
          d.mainBeam.visible = false;
          for (const line of d.tributaryLines) {
            (line.material as THREE.LineBasicMaterial).opacity = 0;
          }
        }
      } else if (d.stage === 'receding') {
        d.satelliteGroup.scale.multiplyScalar(Math.max(0, 1.0 - delta * 2.0));
        if (d.timer >= 0.8) {
          context.scene.remove(d.satelliteGroup);
          disposeNode(d.satelliteGroup);
          this.activeDestroyers.splice(i, 1);
        }
      }
    }
  }

  public dispose(): void {
    for (const d of this.activeDestroyers) {
      disposeNode(d.satelliteGroup);
    }
    this.activeDestroyers = [];
  }
}
