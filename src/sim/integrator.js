// Physical constants
export const MU = 3.986004418e14; // m^3/s^2 (Earth gravitational parameter)
export const EARTH_RADIUS = 6378137.0; // meters
export const J2 = 1.08262668e-3; // J2 coefficient
export const DRAG_COEFFICIENT = 2.2;
export const ATMOSPHERE_RHO0 = 1.225;
export const ATMOSPHERE_SCALE = 72000.0;

// Two-body gravitational acceleration
export function gravitationalAcceleration(position, mu = MU) {
  const [x, y, z] = position
  const r = Math.sqrt(x * x + y * y + z * z)
  
  // DEBUG: Prevent division by zero
  if (r === 0) {
    console.warn('Zero radius in gravity calculation')
    return [0, 0, 0]
  }
  
  const r3 = r * r * r
  const factor = -mu / r3
  
  return [
    factor * x,
    factor * y, 
    factor * z
  ]
}

// J2 perturbation acceleration
export function j2Acceleration(position) {
  const [x, y, z] = position;
  const r = Math.sqrt(x * x + y * y + z * z);
  
  if (r === 0) return [0, 0, 0];
  
  const r2 = r * r;
  const z2 = z * z;
  const factor = (1.5 * J2 * MU * EARTH_RADIUS * EARTH_RADIUS) / (r2 * r2 * r);
  
  return [
    factor * x * (5 * z2 / r2 - 1),
    factor * y * (5 * z2 / r2 - 1),
    factor * z * (5 * z2 / r2 - 3)
  ];
}

// Atmospheric drag acceleration
export function dragAcceleration(position, velocity, areaToMass = 0.01) {
  const [x, y, z] = position;
  const [vx, vy, vz] = velocity;
  
  const altitude = Math.sqrt(x * x + y * y + z * z) - EARTH_RADIUS;
  
  // No drag in space (above atmosphere)
  if (altitude > 500000) return [0, 0, 0];
  
  // Exponential atmosphere model
  const rho = ATMOSPHERE_RHO0 * Math.exp(-altitude / ATMOSPHERE_SCALE);
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
  
  if (v === 0) return [0, 0, 0];
  
  const dragMag = -0.5 * DRAG_COEFFICIENT * rho * areaToMass * v;
  
  return [
    dragMag * vx,
    dragMag * vy,
    dragMag * vz
  ];
}

// DEBUG: Enhanced RK4 with validation (J2 and Drag temporarily disabled for debugging)
export function rk4Step(state, dt, areaToMass = 0.01, enableJ2 = false, enableDrag = false) {
  // DEBUG: Check input state
  if (state.some(isNaN)) {
    console.error('❌ RK4 Input state has NaN:', state)
    return state
  }

  const derivative = (currentState) => {
    const [x, y, z, vx, vy, vz] = currentState
    const pos = [x, y, z]
    const vel = [vx, vy, vz]
    
    // DEBUG
    if (pos.some(isNaN) || vel.some(isNaN)) {
      console.error('❌ Derivative input has NaN:', currentState)
      return [0, 0, 0, 0, 0, 0]
    }
    
    // Two-body gravity (always enabled)
    let accel = gravitationalAcceleration(pos)
    
    // DEBUG: Check acceleration
    if (accel.some(isNaN)) {
      console.error('❌ Acceleration has NaN:', accel, 'from pos:', pos)
      accel = [0, 0, 0]
    }
    
    // J2 perturbation (TEMPORARILY DISABLED FOR DEBUGGING)
    if (enableJ2) {
      const j2Accel = j2Acceleration(pos)
      accel[0] += j2Accel[0]
      accel[1] += j2Accel[1]
      accel[2] += j2Accel[2]
    }
    
    // Atmospheric drag (TEMPORARILY DISABLED FOR DEBUGGING)
    if (enableDrag) {
      const dragAccel = dragAcceleration(pos, vel, areaToMass)
      accel[0] += dragAccel[0]
      accel[1] += dragAccel[1]
      accel[2] += dragAccel[2]
    }
    
    return [vx, vy, vz, accel[0], accel[1], accel[2]]
  }

  try {
    const k1 = derivative(state)
    const k2 = derivative(state.map((s, i) => s + 0.5 * dt * k1[i]))
    const k3 = derivative(state.map((s, i) => s + 0.5 * dt * k2[i]))
    const k4 = derivative(state.map((s, i) => s + dt * k3[i]))

    const newState = state.map((s, i) => 
      s + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
    )
    
    // DEBUG: Check output state
    if (newState.some(isNaN)) {
      console.error('❌ RK4 Output state has NaN:', newState)
      return state // Return original state on error
    }
    
    return newState
  } catch (error) {
    console.error('❌ RK4 Step Error:', error)
    return state // Return original state on error
  }
}

// Enhanced propagation with physics flags
export function propagateSatellite(satellite, dt, steps = 1, enableJ2 = true, enableDrag = true) {
  let state = [
    satellite.position[0],
    satellite.position[1], 
    satellite.position[2],
    satellite.velocity[0],
    satellite.velocity[1],
    satellite.velocity[2]
  ];

  for (let i = 0; i < steps; i++) {
    state = rk4Step(state, dt, satellite.areaToMass, enableJ2, enableDrag);
  }

  return {
    ...satellite,
    position: state.slice(0, 3),
    velocity: state.slice(3, 6)
  };
}

// Propagate all satellites
export function propagateAllSatellites(satellites, dt, steps = 1, enableJ2 = true, enableDrag = true) {
  return satellites.map(sat => propagateSatellite(sat, dt, steps, enableJ2, enableDrag));
}
