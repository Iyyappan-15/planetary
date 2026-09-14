import * as THREE from 'three';
import { disposeNode } from '../utils/disposal';

export class BeamEffect {
  public group: THREE.Group;
  private coreBeam: THREE.Mesh;
  private glowBeam: THREE.Mesh;
  private contactFlare: THREE.Mesh;
  public isActive: boolean = false;

  constructor(colorHex: string = '#00ffff') {
    this.group = new THREE.Group();
    this.group.visible = false;

    const baseColor = new THREE.Color(colorHex);

    // Inner core (bright white-hot)
    const coreGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 16);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.coreBeam = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreBeam);

    // Outer glow sleeve
    const glowGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 16);
    glowGeo.translate(0, 0.5, 0);
    glowGeo.rotateX(Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.glowBeam = new THREE.Mesh(glowGeo, glowMat);
    this.group.add(this.glowBeam);

    // Ground impact flare
    const flareGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const flareMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.contactFlare = new THREE.Mesh(flareGeo, flareMat);
    this.group.add(this.contactFlare);
  }

  public setBeam(start: THREE.Vector3, end: THREE.Vector3): void {
    this.group.visible = true;
    this.isActive = true;

    const distance = start.distanceTo(end);

    this.coreBeam.position.copy(start);
    this.coreBeam.lookAt(end);
    this.coreBeam.scale.set(1, 1, distance);

    this.glowBeam.position.copy(start);
    this.glowBeam.lookAt(end);
    this.glowBeam.scale.set(1, 1, distance);

    this.contactFlare.position.copy(end);
    const pulse = 1.0 + Math.sin(performance.now() * 0.03) * 0.25;
    this.contactFlare.scale.set(pulse, pulse, pulse);
  }

  public hide(): void {
    this.group.visible = false;
    this.isActive = false;
  }

  public dispose(): void {
    disposeNode(this.group);
  }
}
