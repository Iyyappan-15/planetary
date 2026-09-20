import * as THREE from 'three';
import { Weapon, WeaponContext } from '../Weapon';
import { TargetInfo } from '../../types/weapon';
import { disposeNode } from '../../utils/disposal';
import { vector3ToUV, vector3ToLatLon } from '../../utils/math';

interface ActiveDragon {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  head: THREE.Group;
  breathMesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetNormal: THREE.Vector3;
  timer: number;
  duration: number;
}

export class CosmicDragonWeapon extends Weapon {
  private activeDragons: ActiveDragon[] = [];

  constructor() {
    super({
      id: 'cosmic_dragon',
      name: 'Cosmic Dragon',
      category: 'monsters',
      description: 'Winged celestial dragon that descends from the heavens, sweeping the globe with a colossal breath of thermonuclear fire.',
      cooldownMs: 3000,
      iconName: 'Flame',
      damageRadius: 0.2,
      damageIntensity: 1.6,
    });
  }

  private createDragonMesh(): { group: THREE.Group; leftWing: THREE.Group; rightWing: THREE.Group; head: THREE.Group; breathMesh: THREE.Mesh } {
    const group = new THREE.Group();

    // Celestial scale material
    const scaleMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      emissive: 0x004488,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8,
    });

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      blending: THREE.AdditiveBlending,
    });

    // 1. Torso body
    const bodyGeo = new THREE.ConeGeometry(0.35, 1.6, 12);
    const body = new THREE.Mesh(bodyGeo, scaleMat);
    body.rotation.x = -Math.PI / 2;
    group.add(body);

    // 2. Neck & Head
    const head = new THREE.Group();
    head.position.set(0, 0.2, 0.9);

    const neckGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.7, 8);
    const neck = new THREE.Mesh(neckGeo, scaleMat);
    neck.rotation.x = Math.PI / 4;
    head.add(neck);

    const skullGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
    const skull = new THREE.Mesh(skullGeo, scaleMat);
    skull.rotation.x = Math.PI / 2;
    skull.position.set(0, 0.25, 0.35);
    head.add(skull);

    // Glowing dragon eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, glowMat);
    leftEye.position.set(0.1, 0.32, 0.35);
    head.add(leftEye);
    const rightEye = leftEye.clone();
    rightEye.position.x = -0.1;
    head.add(rightEye);

    // Atomic breath cone
    const breathGeo = new THREE.ConeGeometry(0.6, 2.5, 16, 1, true);
    const breathMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const breathMesh = new THREE.Mesh(breathGeo, breathMat);
    breathMesh.position.set(0, 0.2, 1.8);
    breathMesh.rotation.x = -Math.PI / 2;
    breathMesh.visible = false;
    head.add(breathMesh);

    group.add(head);

    // 3. Wings
    const createWing = (isRight: boolean): THREE.Group => {
      const wing = new THREE.Group();
      const boneGeo = new THREE.CylinderGeometry(0.06, 0.12, 1.8, 8);
      const bone = new THREE.Mesh(boneGeo, scaleMat);
      bone.rotation.z = isRight ? -Math.PI / 3 : Math.PI / 3;
      bone.position.set(isRight ? 0.7 : -0.7, 0.3, 0);
      wing.add(bone);

      const sailGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        isRight ? 1.6 : -1.6, 0.8, -0.4,
        isRight ? 1.2 : -1.2, -0.2, -1.2,
      ]);
      sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      sailGeo.computeVertexNormals();

      const sailMat = new THREE.MeshStandardMaterial({
        color: 0x00aacc,
        emissive: 0x004466,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const sail = new THREE.Mesh(sailGeo, sailMat);
      wing.add(sail);
      return wing;
    };

    const leftWing = createWing(false);
    group.add(leftWing);
    const rightWing = createWing(true);
    group.add(rightWing);

    // 4. Tail
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.2, 1.4, 8);
    const tail = new THREE.Mesh(tailGeo, scaleMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, -0.05, -1.4);
    group.add(tail);

    return { group, leftWing, rightWing, head, breathMesh };
  }

  public execute(target: TargetInfo, context: WeaponContext): void {
    if (!this.canFire()) return;
    this.lastFiredTime = performance.now();

    const startPos = target.point.clone().addScaledVector(target.normal, 10.0);
    // Offset sideways for swooping dive
    const up = Math.abs(target.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(target.normal, up).normalize();
    startPos.addScaledVector(side, 4.0);

    const { group, leftWing, rightWing, head, breathMesh } = this.createDragonMesh();
    group.position.copy(startPos);
    group.lookAt(target.point);
    context.scene.add(group);

    this.activeDragons.push({
      group,
      leftWing,
      rightWing,
      head,
      breathMesh,
      startPos,
      targetPos: target.point.clone(),
      targetNormal: target.normal.clone(),
      timer: 0,
      duration: 6.5,
    });

    context.audioManager.playDragonBreath();
  }

  public update(delta: number, context: WeaponContext): void {
    for (let i = this.activeDragons.length - 1; i >= 0; i--) {
      const d = this.activeDragons[i];
      d.timer += delta;

      // Wing flapping animation
      const flap = Math.sin(d.timer * 7.0) * 0.45;
      d.leftWing.rotation.z = flap;
      d.rightWing.rotation.z = -flap;

      const progress = d.timer / d.duration;

      // Swoop trajectory: deep space -> low planetary orbit -> exit to deep space
      const swoopAltitude = context.planet.config.radius + 1.3;
      const hoverCenter = d.targetPos.clone().normalize().multiplyScalar(swoopAltitude);

      if (progress < 0.35) {
        // Phase 1: Swoop descent into orbital hover
        const t = progress / 0.35;
        d.group.position.lerpVectors(d.startPos, hoverCenter, Math.sin((t * Math.PI) / 2));
        d.group.lookAt(d.targetPos);
      } else if (progress < 0.75) {
        // Phase 2: Unleash atomic thermonuclear breath
        d.breathMesh.visible = true;

        // Orbit around the targeted continent
        const orbitAngle = (progress - 0.35) * 4.0;
        const up = Math.abs(d.targetNormal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const tanU = new THREE.Vector3().crossVectors(d.targetNormal, up).normalize();
        d.group.position.copy(hoverCenter).addScaledVector(tanU, Math.sin(orbitAngle) * 0.5);
        d.group.lookAt(d.targetPos);

        // Ground damage and atomic fire particles
        if (Math.random() < 0.25) {
          const local = d.targetPos.clone();
          context.planet.surfaceMesh.worldToLocal(local);
          const uv = vector3ToUV(local);
          const { lat, lon } = vector3ToLatLon(local);

          context.planet.registerImpact({
            u: uv.u,
            v: uv.v,
            lat,
            lon,
            position: d.targetPos,
            radius: 0.05,
            intensity: 0.7,
            heat: 1.0,
            timestamp: performance.now(),
            type: 'laser',
          });

          context.particleSystem.emit(d.targetPos, d.targetNormal, 15, '#00ffff', 1.2, 3.5, 0.8, 0.4);
          context.cameraController.addTrauma(0.12);
        }
      } else {
        // Phase 3: Soar away into the cosmos
        d.breathMesh.visible = false;
        const exitPos = hoverCenter.clone().addScaledVector(d.targetNormal, 12.0);
        const t = (progress - 0.75) / 0.25;
        d.group.position.lerpVectors(hoverCenter, exitPos, t * t);
      }

      if (d.timer >= d.duration) {
        context.scene.remove(d.group);
        disposeNode(d.group);
        this.activeDragons.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const d of this.activeDragons) {
      disposeNode(d.group);
    }
    this.activeDragons = [];
  }
}
