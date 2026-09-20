import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';

interface ActiveExtractor {
  harvesterGroup: THREE.Group;
  extractedChunk: THREE.Mesh;
  cuttingBeams: THREE.Line[];
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
  hasCarved: boolean;
}

export class ChunkExtractorWeapon extends Weapon {
  private activeExtractors: ActiveExtractor[] = [];

  constructor() {
    super({
      id: 'chunk_extractor',
      name: 'Chunk Extractor',
      category: 'alien',
      description: 'Colossal extraterrestrial mining beam carves a spherical section of the planet out and warps it into deep space.',
      cooldownMs: 3000,
      iconName: 'Scissors',
      damageRadius: 0.22,
      damageIntensity: 2.0,
    });
  }

  private createHarvesterMesh(): THREE.Group {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1a2430,
      metalness: 0.9,
      roughness: 0.2,
    });

    // 1. Triangular Mothership Hull
    const hullGeo = new THREE.CylinderGeometry(0.8, 1.4, 0.25, 3);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    group.add(hull);

    // 2. Ventral Graviton Core
    const coreGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = -0.15;
    group.add(core);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const altitude = context.planet.config.radius + 2.5;
    const harvesterPos = target.normal.clone().multiplyScalar(altitude);
    const harvesterGroup = this.createHarvesterMesh();
    harvesterGroup.position.copy(harvesterPos);
    harvesterGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), target.normal);
    context.scene.add(harvesterGroup);

    // Carved planet chunk
    const chunkGeo = new THREE.DodecahedronGeometry(0.45, 2);
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x443322,
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
      roughness: 0.8,
    });
    const extractedChunk = new THREE.Mesh(chunkGeo, chunkMat);
    extractedChunk.position.copy(target.point);
    extractedChunk.visible = false;
    context.scene.add(extractedChunk);

    // 3 Cutting Beams
    const cuttingBeams: THREE.Line[] = [];
    const beamMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.85 });
    for (let b = 0; b < 3; b++) {
      const geo = new THREE.BufferGeometry().setFromPoints([harvesterPos, target.point]);
      const beam = new THREE.Line(geo, beamMat);
      context.scene.add(beam);
      cuttingBeams.push(beam);
    }

    this.activeExtractors.push({
      harvesterGroup,
      extractedChunk,
      cuttingBeams,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 6.0,
      hasCarved: false,
    });

    context.audioManager.playChunkExtractor();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeExtractors.length - 1; i >= 0; i--) {
      const e = this.activeExtractors[i];
      e.timer += delta;
      e.harvesterGroup.rotation.y += delta * 1.5;

      // Phase 1: Laser carving circle (0.0 -> 2.0s)
      if (e.timer < 2.0) {
        for (let b = 0; b < e.cuttingBeams.length; b++) {
          const angle = e.timer * 4.0 + (b / 3) * Math.PI * 2;
          const up = Math.abs(e.targetNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const tanU = new THREE.Vector3().crossVectors(e.targetNormal, up).normalize();
          const tanV = new THREE.Vector3().crossVectors(e.targetNormal, tanU).normalize();

          const cutPoint = e.targetPos.clone()
            .addScaledVector(tanU, Math.cos(angle) * 0.35)
            .addScaledVector(tanV, Math.sin(angle) * 0.35);

          e.cuttingBeams[b].geometry.setFromPoints([e.harvesterGroup.position, cutPoint]);
        }

        if (Math.random() < 0.3) {
          context.particleSystem.emit(e.targetPos, e.targetNormal, 4, '#00ff88', 0.4, 1.5, 0.3, 0.1);
        }
      } else if (!e.hasCarved) {
        e.hasCarved = true;
        e.extractedChunk.visible = true;
        for (const b of e.cuttingBeams) {
          context.scene.remove(b);
          disposeNode(b);
        }

        // Register deep crater excavation
        context.planet.registerImpact({
          u: 0.5,
          v: 0.5,
          position: e.targetPos,
          radius: this.config.damageRadius,
          intensity: this.config.damageIntensity,
          heat: 1.0,
          timestamp: performance.now(),
        });

        context.shockwaveSystem.create(e.targetPos, e.targetNormal, context.planet.config.radius * 0.8, '#00ff88');
        context.particleSystem.emit(e.targetPos, e.targetNormal, 70, '#ff4400', 2.0, 5.0, 1.5, 0.8);
        context.cameraController.addTrauma(0.5);
      } else {
        // Phase 2: Tractor beam lifts chunk into mothership & hyperspace warp
        const liftProgress = Math.min(1.0, (e.timer - 2.0) / 3.0);
        e.extractedChunk.position.lerpVectors(e.targetPos, e.harvesterGroup.position, liftProgress);
        e.extractedChunk.rotation.x += delta * 2.0;

        if (liftProgress >= 0.95) {
          const fade = Math.max(0, (e.duration - e.timer) / 1.0);
          e.extractedChunk.scale.set(fade, fade, fade);
          e.harvesterGroup.scale.set(fade, fade, fade);
        }
      }

      if (e.timer >= e.duration) {
        context.scene.remove(e.harvesterGroup);
        context.scene.remove(e.extractedChunk);
        disposeNode(e.harvesterGroup);
        disposeNode(e.extractedChunk);
        this.activeExtractors.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const e of this.activeExtractors) {
      disposeNode(e.harvesterGroup);
      disposeNode(e.extractedChunk);
      for (const b of e.cuttingBeams) {
        disposeNode(b);
      }
    }
    this.activeExtractors = [];
  }
}
