import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import OrbitCanvas from './OrbitCanvas'
import ControlPanel from './ControlPanel'
import { GlobeSystem } from './GlobeSystem'
import { propagateAllSatellites } from '../sim/integrator'
import { detectConjunctions } from '../sim/detector'
import './Simulation.css'

// Constants
const BASE_TIME_STEP = 1.0 // seconds per simulation step
const TIME_WINDOW_HOURS = 48 // Detection window
const FRAME_INTERVAL = 16 // ~60 FPS

const Simulation = ({ satellites: initialSatellites, onReset }) => {
  const [satellites, setSatellites] = useState(initialSatellites)
  const [conjunctions, setConjunctions] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [simulationTime, setSimulationTime] = useState(0)
  const [selectedSatellite, setSelectedSatellite] = useState(null)
  const [viewMode, setViewMode] = useState('XY')
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [visualizationMode, setVisualizationMode] = useState('globe') // 'globe' or 'canvas'
  
  const animationRef = useRef(null)
  const lastTimeRef = useRef(0)
  const frameCountRef = useRef(0)

  // DEBUG: Check for NaN in satellite states
  const checkForNaN = useCallback((sats) => {
    for (const sat of sats) {
      for (const val of [...sat.position, ...sat.velocity]) {
        if (isNaN(val)) {
          console.error('NaN detected in satellite:', sat.id, sat.position, sat.velocity)
          return true
        }
      }
    }
    return false
  }, [])

  // DEBUG: Log satellite state periodically
  const debugLogState = useCallback((sats, frame) => {
    if (frame % 120 === 0 && sats.length > 0) { // Every ~2 seconds at 60fps
      const sat = sats[0]
      console.log(`Frame ${frame}: ${sat.id} pos=[${sat.position.map(p => p.toFixed(1)).join(', ')}] vel=[${sat.velocity.map(v => v.toFixed(1)).join(', ')}]`)
    }
  }, [])

  // Enhanced simulation tick with debugging
  const tick = useCallback((currentTime) => {
    frameCountRef.current++
    
    if (!lastTimeRef.current) {
      lastTimeRef.current = currentTime
      console.log('Animation loop started')
    }
    
    const deltaTime = (currentTime - lastTimeRef.current) / 1000
    lastTimeRef.current = currentTime
    
    if (isPlaying && deltaTime > 0) {
      console.log(`Tick: frame=${frameCountRef.current}, delta=${deltaTime.toFixed(3)}s`)
      
      try {
        // Calculate actual time step based on speed multiplier
        const dt = BASE_TIME_STEP * speedMultiplier
        const steps = Math.max(1, Math.floor(dt / BASE_TIME_STEP))
        
        console.log(`Propagating ${satellites.length} satellites, dt=${dt}s, steps=${steps}`)
        
        setSatellites(prev => {
          const newSats = propagateAllSatellites(prev, BASE_TIME_STEP, steps, false, false) // TEMP: Disable J2 & drag
          
          // DEBUG: Check for issues
          if (checkForNaN(newSats)) {
            console.error('STOPPING SIMULATION: NaN detected')
            setIsPlaying(false)
            return prev
          }
          
          debugLogState(newSats, frameCountRef.current)
          return newSats
        })

        setSimulationTime(prev => prev + dt)
        
        // Detect conjunctions
        console.log('Checking conjunctions...')
        const newConjunctions = detectConjunctions(satellites, 100.0) // Increased threshold for testing
        if (newConjunctions.length > 0) {
          console.log(`Found ${newConjunctions.length} conjunctions:`, newConjunctions)
        }
        setConjunctions(newConjunctions)
        
      } catch (error) {
        console.error('Error in simulation tick:', error)
        setIsPlaying(false)
      }
    }
    
    animationRef.current = requestAnimationFrame(tick)
  }, [isPlaying, speedMultiplier, satellites, checkForNaN, debugLogState])

  // Robust animation loop
  useEffect(() => {
    let running = true
    
    const loop = (time) => {
      if (!running) return
      tick(time)
    }
    
    if (isPlaying) {
      console.log('Starting animation loop')
      lastTimeRef.current = 0
      frameCountRef.current = 0
      animationRef.current = requestAnimationFrame(loop)
    } else {
      console.log('Stopping animation loop')
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    
    return () => {
      running = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, tick])

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  const handleResetSimulation = useCallback(() => {
    setIsPlaying(false)
    setSatellites(initialSatellites)
    setSimulationTime(0)
    setConjunctions([])
    setSelectedSatellite(null)
    lastTimeRef.current = 0
    frameCountRef.current = 0
  }, [initialSatellites])

  const handleSatelliteClick = useCallback((satellite) => {
    setSelectedSatellite(satellite)
  }, [])

  const handleGlobeSatelliteClick = useCallback((state) => {
    // Find the corresponding satellite from the states
    const sat = satellites.find(s => s.id === state.id)
    if (sat) {
      setSelectedSatellite(sat)
    }
  }, [satellites])
  
  const handleSpeedChange = useCallback((speed) => {
    setSpeedMultiplier(speed)
  }, [])
  
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
  }, [])
  
  // Memoize formatted time for performance
  const formattedTime = useMemo(() => {
    const totalSeconds = Math.round(simulationTime)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }, [simulationTime])
  
  // Memoize stats for performance
  const stats = useMemo(() => ({
    satelliteCount: satellites.length,
    conjunctionCount: conjunctions.length,
    criticalConjunctions: conjunctions.filter(c => c.severity === 'CRITICAL').length
  }), [satellites.length, conjunctions])

  return (
    <div className="simulation">
      <div className="simulation-header">
        <div className="simulation-info">
          <h2>Real-time Simulation</h2>
          <div className="stats">
            <span>Satellites: {stats.satelliteCount}</span>
            <span>Conjunctions: {stats.conjunctionCount}</span>
            {stats.criticalConjunctions > 0 && (
              <span className="critical">Critical: {stats.criticalConjunctions}</span>
            )}
            <span>Time: {formattedTime}</span>
          </div>
        </div>
        
        <div className="simulation-controls">
          <div className="view-toggle">
            <button
              className={`control-button ${visualizationMode === 'globe' ? 'active' : ''}`}
              onClick={() => setVisualizationMode('globe')}
              title="3D Globe View"
            >
              🌍 Globe
            </button>
            <button
              className={`control-button ${visualizationMode === 'canvas' ? 'active' : ''}`}
              onClick={() => setVisualizationMode('canvas')}
              title="2D Canvas View"
            >
              📊 Canvas
            </button>
          </div>
          <button 
            className={`control-button ${isPlaying ? 'pause' : 'play'}`}
            onClick={handlePlayPause}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="control-button reset" onClick={handleResetSimulation}>
            Reset
          </button>
          <button className="control-button" onClick={onReset}>
            Load New Data
          </button>
        </div>
      </div>

      <div className="simulation-content">
        <div className="visualization-panel">
          <ControlPanel
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            simulationSpeed={speedMultiplier}
            onSpeedChange={handleSpeedChange}
            conjunctions={conjunctions}
            selectedSatellite={selectedSatellite}
            isRunning={isPlaying}
            onPlayPause={handlePlayPause}
            onReset={handleResetSimulation}
          />
          
          {visualizationMode === 'globe' ? (
            <div className="globe-container">
              <GlobeSystem
                satellites={satellites}
                conjunctions={conjunctions}
                onSatelliteClick={handleGlobeSatelliteClick}
              />
            </div>
          ) : (
            <OrbitCanvas
              satellites={satellites}
              conjunctions={conjunctions}
              viewMode={viewMode}
              onSatelliteClick={handleSatelliteClick}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Simulation
