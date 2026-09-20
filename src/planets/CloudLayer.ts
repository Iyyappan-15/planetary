import * as THREE from 'three';
import { CloudProfile } from '../types/planet';
import { ProceduralTextures } from '../utils/textures';
import { disposeNode } from '../utils/disposal';

export class CloudLayer {
  public mesh: THREE.Mesh;
  public texture: THREE.Texture;
  private rotationSpeed: number;
  private material: THREE.MeshStandardMaterial;

  constructor(radius: number, profile: CloudProfile, isEarth: boolean = false) {
    this.rotationSpeed = profile.speed;
    const geometry = new THREE.SphereGeometry(radius * (1.0 + (profile.altitude || 0.016)), 64, 64);

    if (isEarth) {
      const loader = new THREE.TextureLoader();
      this.texture = loader.load('./earth_clouds.png');
      this.texture.wrapS = THREE.RepeatWrapping;
      this.texture.wrapT = THREE.ClampToEdgeWrapping;
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
    } else {
      this.texture = ProceduralTextures.createCloudTexture(1024, 512, profile.seed);
    }

    // Soft, smooth photorealistic cloud material with bilinear interpolation (zero pixelation/dither artifacts)
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: isEarth ? 0.52 : profile.opacity * 0.7,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  public update(delta: number): void {
    this.mesh.rotation.y += this.rotationSpeed * delta;
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public setOpacity(opacity: number): void {
    this.material.opacity = opacity;
  }

  public dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    disposeNode(this.mesh);
  }
}
