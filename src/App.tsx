import React, { useState, useRef } from 'react'
import Simulation from './components/Simulation'
import CsvUpload from './components/CsvUpload'
import './App.css'

function App() {
  const [satellites, setSatellites] = useState<any[]>([])
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)

  const handleSatellitesLoaded = (satellitesData: any) => {
    setSatellites(satellitesData)
    setIsSimulationRunning(true)
  }

  const handleReset = () => {
    setSatellites([])
    setIsSimulationRunning(false)
  }

  // Test with guaranteed collision data
  const loadTestData = () => {
    console.log('Loading test collision data...')
    
    const testSatellites = [
      {
        id: "COLLIDE1",
        epoch: 0,
        position: [-6671000, 0, 0],        // 300km altitude
        velocity: [0, 7680, 0],            // Circular orbit
        radius: 5,
        areaToMass: 0.01,
        color: "#ff4444"
      },
      {
        id: "COLLIDE2", 
        epoch: 0,
        position: [-6671000, 50, 0],       // Only 50m away!
        velocity: [0, 7680, 0],            // Same velocity
        radius: 5,
        areaToMass: 0.01,
        color: "#44ff44"
      },
      {
        id: "CLOSE3",
        epoch: 0,
        position: [-6670000, 0, 100],      // 1km in X, 100m in Z
        velocity: [0, 7679, 0.1],          // Slightly different
        radius: 5,
        areaToMass: 0.01,
        color: "#4444ff"
      }
    ]
    
    console.log('Test satellites:', testSatellites)
    setSatellites(testSatellites)
    setIsSimulationRunning(true)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Satellite Collision Simulator</h1>
        <p>Client-side simulation • Debug Mode</p>
      </header>

      <main className="app-main">
        {!isSimulationRunning ? (
          <div className="upload-section">
            <CsvUpload onSatellitesLoaded={handleSatellitesLoaded} />
            
            {/* TEST BUTTON */}
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button 
                onClick={loadTestData}
                style={{
                  background: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 2rem',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  cursor: 'pointer'
                }}
              >
                Load Test Collision Data
              </button>
              <p style={{ marginTop: '0.5rem', color: '#ccc' }}>
                Use this to test if conjunctions work
              </p>
            </div>
            
            <div className="sample-data">
              <h3>Sample CSV Format:</h3>
              <pre>{`sat_id,epoch_iso,x_m,y_m,z_m,vx_mps,vy_mps,vz_mps,r_m,a2m
S1,2025-11-17T00:00:00Z,-6371000,0,0,0,7660,0,1.0,0.01
S2,2025-11-17T00:00:00Z,-6371000,100,0,0,7660,0,1.0,0.01`}</pre>
            </div>
          </div>
        ) : (
          <Simulation 
            satellites={satellites}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}

export default App
