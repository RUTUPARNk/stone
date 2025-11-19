import { useState } from 'react'
import './Simulation.css'

export default function Simulation() {
  const [isRunning, setIsRunning] = useState(false)

  return (
    <div className="simulation-container">
      <h1>Simulation</h1>
      <p>Welcome to the simulation page</p>
      <button onClick={() => setIsRunning(!isRunning)}>
        {isRunning ? 'Stop' : 'Start'} Simulation
      </button>
      {isRunning && <p>Simulation is running...</p>}
    </div>
  )
}
