import * as THREE from 'three';
import { CloudProfile } from '../types/planet';
import { ProceduralTextures } from '../utils/textures';
import { disposeNode } from '../utils/disposal';

export class CloudLayer {
  public mesh: THREE.Mesh;
  private rotationSpeed: number;
  private texture: THREE.Texture;

  constructor(radius: number, profile: CloudProfile, isEarth: boolean = false) {
    this.rotationSpeed = profile.speed;
    const geometry = new THREE.SphereGeometry(radius * (1.0 + profile.altitude), 64, 64);

    if (isEarth) {
      const loader = new THREE.TextureLoader();
      this.texture = loader.load('./earth_clouds.png');
      this.texture.wrapS = THREE.RepeatWrapping;
      this.texture.wrapT = THREE.ClampToEdgeWrapping;
    } else {
      this.texture = ProceduralTextures.createCloudTexture(1024, 512, profile.seed);
    }

    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      opacity: isEarth ? 0.35 : profile.opacity * 0.75,
      blending: THREE.NormalBlending,
      roughness: 0.9,
      metalness: 0.0,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
  }

  public update(delta: number): void {
    this.mesh.rotation.y += this.rotationSpeed * delta;
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    this.texture.dispose();
    disposeNode(this.mesh);
  }
}
