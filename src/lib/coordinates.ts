// Coordinate conversion utilities
// ECEF (Earth-Centered, Earth-Fixed) to geodetic (lat/lon/alt)

const EARTH_RADIUS = 6378137.0 // meters
const EARTH_FLATTENING = 1 / 298.257223563
const E2 = EARTH_FLATTENING * (2 - EARTH_FLATTENING)

/**
 * Convert ECEF coordinates [x, y, z] to geodetic [lat, lon, alt]
 * @param position ECEF position in meters [x, y, z]
 * @returns [latitude (rad), longitude (rad), altitude (m)]
 */
export function ecefToGeodetic(position: number[]): [number, number, number] {
  const [x, y, z] = position
  const r = Math.sqrt(x * x + y * y + z * z)
  
  if (r === 0) {
    return [0, 0, -EARTH_RADIUS]
  }

  // Use the required formula
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
  const lon = Math.atan2(y, x)
  const alt = r - EARTH_RADIUS
  
  return [lat, lon, alt]
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/**
 * Convert degrees to radians
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Convert lat/lon to 3D unit sphere point
 */
export function latLonToUnit(lat: number, lon: number): { x: number; y: number; z: number } {
  const cosLat = Math.cos(lat)
  return {
    x: cosLat * Math.cos(lon),
    y: cosLat * Math.sin(lon),
    z: Math.sin(lat),
  }
}

/**
 * Rotate 3D point by theta (X-axis) and phi (Y-axis)
 */
export function rotatePoint(
  pt: { x: number; y: number; z: number },
  theta: number,
  phi: number
): { x: number; y: number; z: number } {
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)

  // Rotate around X (theta)
  const x1 = pt.x
  const y1 = pt.y * cosT - pt.z * sinT
  const z1 = pt.y * sinT + pt.z * cosT

  // Rotate around Y (phi)
  const x2 = x1 * cosP + z1 * sinP
  const y2 = y1
  const z2 = -x1 * sinP + z1 * cosP

  return { x: x2, y: y2, z: z2 }
}

/**
 * Project lat/lon to screen coordinates using orthographic projection
 * @param lat Latitude in radians
 * @param lon Longitude in radians
 * @param width SVG width
 * @param height SVG height
 * @param phi COBE's Y-rotation (phi) in radians
 * @param theta COBE's X-rotation (theta) in radians
 * @returns [x, y] in screen coordinates, or null if on far side
 */
export function projectToSVG(
  lat: number,
  lon: number,
  width: number,
  height: number,
  phi: number = 0,
  theta: number = 0,
  radiusPx: number = 0.42
): [number, number] | null {
  // Convert to unit sphere
  const unit = latLonToUnit(lat, lon)
  
  // Rotate by theta (X) then phi (Y)
  const rotated = rotatePoint(unit, theta, phi)
  
  // Orthographic projection: only show if z > 0 (facing camera)
  if (rotated.z <= 0) return null
  
  const centerX = width / 2
  const centerY = height / 2
  const R = Math.min(width, height) * radiusPx
  
  // Project to screen (y decreases for positive y in screen space)
  const x = centerX + rotated.x * R
  const y = centerY - rotated.y * R
  
  return [x, y]
}

/**
 * Compute orbital elements from position and velocity (simplified)
 * Returns semi-major axis, eccentricity, and orbital plane normal
 */
function computeOrbitalElements(
  position: number[],
  velocity: number[]
): { a: number; e: number; normal: [number, number, number] } {
  const MU = 3.986004418e14 // Earth gravitational parameter
  const [x, y, z] = position
  const [vx, vy, vz] = velocity
  
  const r = Math.sqrt(x * x + y * y + z * z)
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz)
  
  // Specific orbital energy
  const energy = (v * v) / 2 - MU / r
  
  // Semi-major axis
  const a = -MU / (2 * energy)
  
  // Angular momentum vector
  const hx = y * vz - z * vy
  const hy = z * vx - x * vz
  const hz = x * vy - y * vx
  const h = Math.sqrt(hx * hx + hy * hy + hz * hz)
  
  // Eccentricity (simplified for near-circular orbits)
  const e = Math.max(0, Math.min(0.99, 1 - (h * h) / (MU * a)))
  
  // Orbital plane normal (normalized)
  const hMag = h || 1
  const normal: [number, number, number] = [hx / hMag, hy / hMag, hz / hMag]
  
  return { a, e, normal }
}

/**
 * Build orbit ring from ECEF position
 * Given one satellite ECEF position vector, approximate a ring path:
 * - compute the normal (use position cross arbitrary vector)
 * - build a circle in the orbital plane around Earth's center that passes near pos
 * - sample N points and convert to lat/lon
 * This is a visualization-friendly approximation (not a high-precision propagator).
 */
export function buildOrbitRingFromEcef(
  x: number,
  y: number,
  z: number,
  samples: number = 160
): Array<[number, number]> {
  // If position near origin, bail
  const rNorm = Math.sqrt(x * x + y * y + z * z)
  if (rNorm < 1) return []

  // unit position
  const ux = x / rNorm
  const uy = y / rNorm
  const uz = z / rNorm

  // choose arbitrary vector not colinear with u
  let ax = 0, ay = 0, az = 1
  if (Math.abs(ux) < 0.1 && Math.abs(uy) < 0.1) {
    ax = 0
    ay = 1
    az = 0
  }

  // orbital normal = cross(u, a)
  let nx = uy * az - uz * ay
  let ny = uz * ax - ux * az
  let nz = ux * ay - uy * ax
  const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
  nx /= nlen
  ny /= nlen
  nz /= nlen

  // radius of orbit circle (distance to Earth's center)
  const R = rNorm

  // find two orthonormal basis vectors in orbital plane
  // e1 = u (point direction normalized)
  const e1x = ux, e1y = uy, e1z = uz
  // e2 = n cross e1
  let e2x = ny * e1z - nz * e1y
  let e2y = nz * e1x - nx * e1z
  let e2z = nx * e1y - ny * e1x
  const e2len = Math.sqrt(e2x * e2x + e2y * e2y + e2z * e2z) || 1
  e2x /= e2len
  e2y /= e2len
  e2z /= e2len

  // sample circle points in this plane centered at origin:
  const points: Array<[number, number]> = []
  for (let i = 0; i < samples; i++) {
    const ang = (2 * Math.PI * i) / samples
    const px = R * (Math.cos(ang) * e1x + Math.sin(ang) * e2x)
    const py = R * (Math.cos(ang) * e1y + Math.sin(ang) * e2y)
    const pz = R * (Math.cos(ang) * e1z + Math.sin(ang) * e2z)
    const [lat, lon] = ecefToGeodetic([px, py, pz])
    points.push([lat, lon])
  }
  return points
}

