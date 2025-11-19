// PhysicsBridge: Converts physics data to renderable states
// Handles CSV, WebSocket, or local propagation data

import { ecefToGeodetic, projectToSVG } from './coordinates'
import { calculateDistance } from '../sim/detector'

export interface SatelliteState {
  id: string
  timestamp: number
  xyz_ecef: [number, number, number]
  lat: number // radians
  lon: number // radians
  alt: number // meters
  velocity: [number, number, number]
  isCloseApproach: boolean
  color?: string
  radius?: number
}

export interface PhysicsBridgeConfig {
  conjunctionThreshold?: number // meters
  debounceFPS?: number // target FPS for updates
}

/**
 * Convert satellite data from simulation format to renderable state
 */
export function convertSatelliteToState(
  satellite: any,
  timestamp: number = Date.now() / 1000
): SatelliteState {
  const [x, y, z] = satellite.position
  const [lat, lon, alt] = ecefToGeodetic([x, y, z])
  
  return {
    id: satellite.id,
    timestamp,
    xyz_ecef: [x, y, z],
    lat,
    lon,
    alt,
    velocity: satellite.velocity || [0, 0, 0],
    isCloseApproach: false, // Will be set by detectCloseApproaches
    color: satellite.color,
    radius: satellite.radius || 1.0
  }
}

/**
 * Detect close approaches between satellites
 */
export function detectCloseApproaches(
  states: SatelliteState[],
  threshold: number = 100000 // 100km default
): void {
  // Reset all flags
  states.forEach(state => {
    state.isCloseApproach = false
  })
  
  // Check all pairs
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      const sat1 = states[i]
      const sat2 = states[j]
      
      const dx = sat2.xyz_ecef[0] - sat1.xyz_ecef[0]
      const dy = sat2.xyz_ecef[1] - sat1.xyz_ecef[1]
      const dz = sat2.xyz_ecef[2] - sat1.xyz_ecef[2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      
      if (distance < threshold) {
        sat1.isCloseApproach = true
        sat2.isCloseApproach = true
      }
    }
  }
}

/**
 * Convert array of satellites to states
 */
export function convertSatellitesToStates(
  satellites: any[],
  timestamp?: number
): SatelliteState[] {
  const states = satellites.map(sat => convertSatelliteToState(sat, timestamp))
  detectCloseApproaches(states)
  return states
}

/**
 * Debounce function for frame rate limiting
 */
export function createDebouncer(targetFPS: number = 30) {
  const interval = 1000 / targetFPS
  let lastTime = 0
  
  return (callback: () => void, currentTime: number = performance.now()) => {
    if (currentTime - lastTime >= interval) {
      lastTime = currentTime
      callback()
      return true
    }
    return false
  }
}

