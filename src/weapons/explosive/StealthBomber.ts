import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface DroppedBomb {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  progress: number;
}

interface ActiveRun {
  jet: THREE.Group;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  direction: THREE.Vector3;
  targetNormal: THREE.Vector3;
  progress: number;
  bombsLeft: number;
  bombTimer: number;
  droppedBombs: DroppedBomb[];
}

export class StealthBomberWeapon extends Weapon {
  private activeRuns: ActiveRun[] = [];

  constructor() {
    super({
      id: 'stealth_bomber',
      name: 'Stealth Bomber',
      category: 'explosives',
      description: 'Futuristic stealth aircraft swoops through the upper atmosphere dropping a string of heavy penetrator bombs.',
      cooldownMs: 1600,
      iconName: 'Plane',
      keyShortcut: '4',
      damageRadius: 0.15,
      damageIntensity: 0.9,
    });
  }

  private createJetMesh(): THREE.Group {
    const group = new THREE.Group();

    // Delta-wing stealth airframe
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.4);
    wingShape.lineTo(0.55, -0.3);
    wingShape.lineTo(0.2, -0.2);
    wingShape.lineTo(0, -0.25);
    wingShape.lineTo(-0.2, -0.2);
    wingShape.lineTo(-0.55, -0.3);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a24,
      metalness: 0.9,
      roughness: 0.2,
    });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.rotation.x = Math.PI / 2;
    group.add(wing);

    // Twin glowing engine exhausts
    const engineGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.08, 8);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const eng1 = new THREE.Mesh(engineGeo, engineMat);
    eng1.rotation.x = Math.PI / 2;
    eng1.position.set(0.1, 0, -0.24);
    group.add(eng1);

    const eng2 = eng1.clone();
    eng2.position.set(-0.1, 0, -0.24);
    group.add(eng2);

    return group;
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const flightDir = new THREE.Vector3().crossVectors(target.normal, up).normalize();

    // Flight path passes right over the target at altitude = 0.5 above planet surface
    const flightAltitude = context.planet.config.radius + 0.6;
    const midPoint = target.normal.clone().multiplyScalar(flightAltitude);
    const startPos = midPoint.clone().addScaledVector(flightDir, -4.5);
    const endPos = midPoint.clone().addScaledVector(flightDir, 4.5);

    const jet = this.createJetMesh();
    jet.position.copy(startPos);
    jet.lookAt(endPos);
    context.scene.add(jet);

    this.activeRuns.push({
      jet,
      startPos,
      endPos,
      direction: flightDir,
      targetNormal: target.normal.clone(),
      progress: 0,
      bombsLeft: 6,
      bombTimer: 0.08,
      droppedBombs: [],
    });

    context.audioManager.playMissileLaunch();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let rIdx = this.activeRuns.length - 1; rIdx >= 0; rIdx--) {
      const run = this.activeRuns[rIdx];
      run.progress += delta * 0.9; // ~1.1s total flight across sky

      run.jet.position.lerpVectors(run.startPos, run.endPos, run.progress);

      // Drop bombs when near the middle segment
      if (run.progress > 0.25 && run.progress < 0.75 && run.bombsLeft > 0) {
        run.bombTimer -= delta;
        if (run.bombTimer <= 0) {
          run.bombTimer = 0.08;
          run.bombsLeft--;
          this.dropBomb(run, context);
        }
      }

      // Update falling bombs
      for (let bIdx = run.droppedBombs.length - 1; bIdx >= 0; bIdx--) {
        const bomb = run.droppedBombs[bIdx];
        bomb.progress += delta * 3.5;
        bomb.mesh.position.lerpVectors(bomb.pos, bomb.targetPos, bomb.progress);

        if (bomb.progress >= 1.0) {
          this.onBombImpact(bomb, context);
          context.scene.remove(bomb.mesh);
          disposeNode(bomb.mesh);
          run.droppedBombs.splice(bIdx, 1);
        }
      }

      if (run.progress >= 1.0 && run.droppedBombs.length === 0) {
        context.scene.remove(run.jet);
        disposeNode(run.jet);
        this.activeRuns.splice(rIdx, 1);
      }
    }
  }

  private dropBomb(run: ActiveRun, context: WeaponContext): void {
    const bombGeo = new THREE.DodecahedronGeometry(0.04, 0);
    const bombMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    const mesh = new THREE.Mesh(bombGeo, bombMat);
    mesh.position.copy(run.jet.position);
    context.scene.add(mesh);

    // Target is directly down onto the planet surface below the jet
    const targetPos = run.jet.position.clone().normalize().multiplyScalar(context.planet.config.radius);

    run.droppedBombs.push({
      mesh,
      pos: run.jet.position.clone(),
      targetPos,
      targetNormal: run.targetNormal,
      progress: 0,
    });
  }

  private onBombImpact(bomb: DroppedBomb, context: WeaponContext): void {
    const local = bomb.targetPos.clone();
    context.planet.surfaceMesh.worldToLocal(local);
    const uv = vector3ToUV(local);
    const { lat, lon } = vector3ToLatLon(local);

    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: bomb.targetPos,
      radius: 0.045,
      intensity: 0.75,
      heat: 0.85,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(bomb.targetPos, bomb.targetNormal, context.planet.config.radius * 0.3, '#ffaa33');
    context.particleSystem.emit(bomb.targetPos, bomb.targetNormal, 30, '#ff6600', 1.1, 3.0, 0.9, 0.6);
    context.cameraController.addTrauma(0.18);
    context.audioManager.playMeteorImpact();
  }

  public dispose(): void {
    for (const r of this.activeRuns) {
      contextDisposal(r.jet);
      for (const b of r.droppedBombs) {
        contextDisposal(b.mesh);
      }
    }
    this.activeRuns = [];
  }
}

function contextDisposal(node: THREE.Object3D): void {
  disposeNode(node);
}
