import React, { useCallback, useMemo } from 'react'
import './ControlPanel.css'

// Constants
const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 20, label: '20x' },
  { value: 100, label: '100x' }
]

const VIEW_MODES = [
  { value: 'XY', label: 'XY Plane (Top Down)' },
  { value: 'XZ', label: 'XZ Plane (Side)' },
  { value: 'YZ', label: 'YZ Plane (Side)' }
]

const MAX_DISPLAYED_CONJUNCTIONS = 10

const ControlPanel = ({ 
  viewMode, 
  onViewModeChange, 
  simulationSpeed, 
  onSpeedChange,
  conjunctions,
  selectedSatellite 
}) => {
  // Memoized event handlers to prevent unnecessary re-renders
  const handleViewModeChange = useCallback((e) => {
    onViewModeChange(e.target.value)
  }, [onViewModeChange])

  const handleSpeedChange = useCallback((e) => {
    onSpeedChange(Number(e.target.value))
  }, [onSpeedChange])

  // Memoize expensive computations
  const displayedConjunctions = useMemo(() => 
    conjunctions.slice(0, MAX_DISPLAYED_CONJUNCTIONS),
    [conjunctions]
  )

  const remainingCount = useMemo(() => 
    Math.max(0, conjunctions.length - MAX_DISPLAYED_CONJUNCTIONS),
    [conjunctions.length]
  )

  const formattedPosition = useMemo(() => 
    selectedSatellite?.position.map(p => p.toFixed(0)).join(', '),
    [selectedSatellite?.position]
  )

  const formattedVelocity = useMemo(() => 
    selectedSatellite?.velocity.map(v => v.toFixed(2)).join(', '),
    [selectedSatellite?.velocity]
  )
  return (
    <div className="control-panel">
      <div className="control-group">
        <label>View:</label>
        <select value={viewMode} onChange={handleViewModeChange}>
          {VIEW_MODES.map(mode => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label>Speed:</label>
        <select value={simulationSpeed} onChange={handleSpeedChange}>
          {SPEED_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="conjunctions-list">
        <h4>Conjunction Alerts ({conjunctions.length})</h4>
        <div className="alerts-container">
          {conjunctions.length === 0 ? (
            <div className="no-alerts">No conjunctions detected</div>
          ) : (
            <>
              {displayedConjunctions.map((conj, index) => (
                <ConjunctionAlert 
                  key={`${conj.sat1}-${conj.sat2}-${index}`} 
                  conjunction={conj} 
                />
              ))}
              {remainingCount > 0 && (
                <div className="alert-more">
                  +{remainingCount} more conjunctions...
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedSatellite && (
        <div className="satellite-info">
          <h4>Selected Satellite</h4>
          <div className="satellite-details">
            <SatelliteDetail label="ID" value={selectedSatellite.id} />
            <SatelliteDetail 
              label="Position" 
              value={`[${formattedPosition}]`} 
            />
            <SatelliteDetail 
              label="Velocity" 
              value={`[${formattedVelocity}] m/s`} 
            />
            <SatelliteDetail 
              label="Radius" 
              value={`${selectedSatellite.radius}m`} 
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Memoized sub-components for optimal performance
const ConjunctionAlert = React.memo(({ conjunction }) => (
  <div className={`alert ${conjunction.severity.toLowerCase()}`}>
    <strong>{conjunction.sat1} ↔ {conjunction.sat2}</strong>
    <br />
    Distance: {conjunction.distance.toFixed(1)}m
    <div className="alert-severity">{conjunction.severity}</div>
  </div>
))

ConjunctionAlert.displayName = 'ConjunctionAlert'

const SatelliteDetail = React.memo(({ label, value }) => (
  <p><strong>{label}:</strong> {value}</p>
))

SatelliteDetail.displayName = 'SatelliteDetail'

export default ControlPanel
