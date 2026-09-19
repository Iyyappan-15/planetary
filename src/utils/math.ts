import * as THREE from 'three';

export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (lon / 360 + 0.5) * 2 * Math.PI;
  const theta = (90 - lat) * (Math.PI / 180);

  const x = -radius * Math.cos(phi) * Math.sin(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

export function vector3ToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const norm = point.clone().normalize();
  const theta = Math.acos(Math.max(-1, Math.min(1, norm.y)));
  const lat = 90 - theta * (180 / Math.PI);

  let phi = Math.atan2(norm.z, -norm.x);
  if (phi < 0) phi += 2 * Math.PI;
  let lon = (phi / (2 * Math.PI) - 0.5) * 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  return { lat, lon };
}

export function vector3ToUV(point: THREE.Vector3): { u: number; v: number } {
  const norm = point.clone().normalize();
  const theta = Math.acos(Math.max(-1, Math.min(1, norm.y)));
  const v = 1.0 - (theta / Math.PI);

  let phi = Math.atan2(norm.z, -norm.x);
  if (phi < 0) phi += 2 * Math.PI;
  const u = phi / (2 * Math.PI);

  return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
