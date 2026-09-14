import * as THREE from 'three';

export function disposeNode(node: THREE.Object3D): void {
  if (!node) return;

  if (node instanceof THREE.Mesh) {
    if (node.geometry) {
      node.geometry.dispose();
    }
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => disposeMaterial(mat));
      } else {
        disposeMaterial(node.material);
      }
    }
  }

  while (node.children.length > 0) {
    const child = node.children[0];
    node.remove(child);
    disposeNode(child);
  }
}

export function disposeMaterial(mat: THREE.Material): void {
  if (!mat) return;
  // Dispose all potential textures on the material
  const materialRecord = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(materialRecord)) {
    const val = materialRecord[key];
    if (val && typeof val === 'object' && (val as { isTexture?: boolean }).isTexture) {
      (val as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}

export function disposeTexture(texture: THREE.Texture | null | undefined): void {
  if (texture) {
    texture.dispose();
  }
}
