import { propagateAllSatellites, propagateSatellite } from './integrator';
import { calculateDistance } from './detector';

// Broad phase: Check every 10 minutes (600 seconds) with larger threshold
export function broadPhaseDetection(satellites, startTime, endTime, broadPhaseDt = 600, threshold = 50000) {
  const candidates = [];
  const checkedPairs = new Set();
  
  // Create time grid for broad phase
  const timeSteps = Math.ceil((endTime - startTime) / broadPhaseDt);
  
  for (let step = 0; step <= timeSteps; step++) {
    const currentTime = startTime + step * broadPhaseDt;
    
    // Propagate all satellites to current time
    const propagatedSats = propagateAllSatellites(satellites, currentTime, 1, true, true);
    
    // Check all pairs
    for (let i = 0; i < propagatedSats.length; i++) {
      for (let j = i + 1; j < propagatedSats.length; j++) {
        const sat1 = propagatedSats[i];
        const sat2 = propagatedSats[j];
        const pairId = [sat1.id, sat2.id].sort().join('-');
        
        if (!checkedPairs.has(pairId)) {
          checkedPairs.add(pairId);
          
          const distance = calculateDistance(sat1, sat2);
          
          if (distance < threshold) {
            // Found candidate - add time window for narrow phase
            const windowStart = Math.max(startTime, currentTime - 300); // ±5 minutes
            const windowEnd = Math.min(endTime, currentTime + 300);
            
            candidates.push({
              sat1: sat1.id,
              sat2: sat2.id,
              windowStart,
              windowEnd,
              broadPhaseDistance: distance
            });
          }
        }
      }
    }
  }
  
  console.log(`Broad phase: Found ${candidates.length} candidate conjunctions`);
  return candidates;
}

// Narrow phase: Fine-grained search in candidate windows
export function narrowPhaseDetection(satellites, candidates, narrowPhaseDt = 10, threshold = 1000) {
  const conjunctions = [];
  
  candidates.forEach(candidate => {
    const sat1 = satellites.find(s => s.id === candidate.sat1);
    const sat2 = satellites.find(s => s.id === candidate.sat2);
    
    if (!sat1 || !sat2) return;
    
    let minDistance = Infinity;
    let tca = candidate.windowStart;
    
    // Search through the time window with fine time steps
    const timeSteps = Math.ceil((candidate.windowEnd - candidate.windowStart) / narrowPhaseDt);
    
    for (let step = 0; step <= timeSteps; step++) {
      const currentTime = candidate.windowStart + step * narrowPhaseDt;
      
      const prop1 = propagateSatellite(sat1, currentTime, 1, true, true);
      const prop2 = propagateSatellite(sat2, currentTime, 1, true, true);
      
      const distance = calculateDistance(prop1, prop2);
      
      if (distance < minDistance) {
        minDistance = distance;
        tca = currentTime;
      }
    }
    
    // Check if this is a real conjunction
    if (minDistance < threshold) {
      conjunctions.push({
        sat1: candidate.sat1,
        sat2: candidate.sat2,
        tca,
        missDistance: minDistance,
        severity: minDistance < (sat1.radius + sat2.radius) ? 'CRITICAL' : 'WARNING'
      });
    }
  });
  
  console.log(`Narrow phase: Found ${conjunctions.length} conjunctions`);
  return conjunctions;
}
