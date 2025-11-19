// Calculate distance between two satellites
export function calculateDistance(sat1, sat2) {
  const [x1, y1, z1] = sat1.position;
  const [x2, y2, z2] = sat2.position;
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Detect conjunctions between all satellite pairs (O(n²))
export function detectConjunctions(satellites, thresholdMultiplier = 1.0) {
  console.log("=== CONJUNCTION DEBUG ===");
  console.log("Satellite positions:", satellites.map(s => ({
    id: s.id, 
    pos: s.position,
    vel: s.velocity
  })));
  
  const conjunctions = [];
  const checkedPairs = new Set();
  
  const n = satellites.length;
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sat1 = satellites[i];
      const sat2 = satellites[j];
      
      // Create unique pair identifier to avoid duplicates
      const pairId = [sat1.id, sat2.id].sort().join('-');
      
      if (!checkedPairs.has(pairId)) {
        checkedPairs.add(pairId);
        
        const distance = calculateDistance(sat1, sat2);
        const collisionThreshold = (sat1.radius + sat2.radius) * thresholdMultiplier;
        
        if (distance < collisionThreshold) {
          const severity = distance < (sat1.radius + sat2.radius) ? 'CRITICAL' : 'WARNING';
          
          conjunctions.push({
            sat1: sat1.id,
            sat2: sat2.id,
            distance: Math.round(distance),
            threshold: Math.round(collisionThreshold),
            severity,
            probability: estimateCollisionProbability(distance, sat1.radius, sat2.radius)
          });
        }
      }
    }
  }
  
  return conjunctions;
}

// Simple collision probability estimation
export function estimateCollisionProbability(distance, radius1, radius2, positionUncertainty = 100) {
  const combinedRadius = radius1 + radius2;
  
  // If already colliding
  if (distance <= combinedRadius) {
    return 1.0;
  }
  
  // Simple Gaussian approximation for probability
  const sigma = positionUncertainty;
  const missDistance = distance - combinedRadius;
  const exponent = -0.5 * (missDistance / sigma) ** 2;
  
  return Math.min(0.99, Math.exp(exponent));
}

// Get conjunction statistics
export function getConjunctionStats(conjunctions) {
  const critical = conjunctions.filter(c => c.severity === 'CRITICAL').length;
  const warning = conjunctions.filter(c => c.severity === 'WARNING').length;
  
  return {
    total: conjunctions.length,
    critical,
    warning,
    hasCritical: critical > 0
  };
}
