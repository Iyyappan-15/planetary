import * as THREE from 'three';

export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

export function vector3ToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const norm = point.clone().normalize();
  const lat = 90 - Math.acos(norm.y) * (180 / Math.PI);
  const lon = ((270 - Math.atan2(norm.x, norm.z) * (180 / Math.PI)) % 360) - 180;
  return { lat, lon };
}

export function vector3ToUV(point: THREE.Vector3): { u: number; v: number } {
  const norm = point.clone().normalize();
  const u = 0.5 + Math.atan2(norm.x, norm.z) / (2 * Math.PI);
  const v = 0.5 - Math.asin(norm.y) / Math.PI;
  return { u: (u + 1) % 1, v: Math.max(0, Math.min(1, v)) };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
