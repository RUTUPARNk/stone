import React, { useRef } from 'react'
import Papa from 'papaparse'
import './CsvUpload.css'

const CsvUpload = ({ onSatellitesLoaded }) => {
  const fileInputRef = useRef(null)

  const parseEpoch = (epochIso) => {
    // Python uses: datetime.fromisoformat().replace(tzinfo=None)
    // JavaScript: Remove timezone and parse as UTC
    const cleanEpoch = epochIso.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '')
    const satEpoch = new Date(cleanEpoch + 'Z').getTime() // Force UTC
    
    // Reference epoch (same as Python: 2025-01-01)
    const refEpoch = new Date('2025-01-01T00:00:00Z').getTime()
    
    return (satEpoch - refEpoch) / 1000 // Return seconds
  }

  // Enhanced CSV parsing with validation
  const parseRow = (row, index) => {
    const [sat_id, epoch_iso, x_m, y_m, z_m, vx_mps, vy_mps, vz_mps, r_m, a2m, cov_json] = row
    
    // Convert all numeric fields with validation
    const position = [
      parseFloat(x_m) || 0,
      parseFloat(y_m) || 0, 
      parseFloat(z_m) || 0
    ]
    
    const velocity = [
      parseFloat(vx_mps) || 0,
      parseFloat(vy_mps) || 0,
      parseFloat(vz_mps) || 0
    ]
    
    const radius = parseFloat(r_m) || 1.0
    const areaToMass = parseFloat(a2m) || 0.01
    
    // Validate numbers
    const hasNaN = [...position, ...velocity].some(isNaN)
    if (hasNaN) {
      console.error(`CSV Parse Error in row ${index}:`, {
        sat_id, position, velocity, radius, areaToMass
      })
      return null
    }
    
    console.log(`Parsed ${sat_id}:`, {
      position,
      velocity,
      radius,
      areaToMass
    })
    
    return {
      id: sat_id,
      epoch: parseEpoch(epoch_iso),
      position,
      velocity,
      radius,
      areaToMass,
      covJson: cov_json || "[[100,0,0],[0,100,0],[0,0,100]]",
      color: `hsl(${(index * 137.5) % 360}, 70%, 60%)`
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    Papa.parse(file, {
      complete: (results) => {
        console.log('Raw CSV data:', results.data)
        
        const satellites = results.data
          .filter(row => row.length >= 6 && row[0] && row[0] !== 'sat_id')
          .map((row, index) => parseRow(row, index))
          .filter(Boolean) // Remove null entries from failed parsing
        
        console.log(`Successfully loaded ${satellites.length} satellites:`, satellites)
        
        if (satellites.length === 0) {
          console.error('No valid satellites loaded from CSV!')
          alert('Error: No valid satellite data found in CSV file. Check the format.')
          return
        }
        
        onSatellitesLoaded(satellites)
      },
      error: (error) => {
        console.error('CSV Parse Error:', error)
        alert('Error parsing CSV file. Please check the format.')
      },
      header: false,
      skipEmptyLines: true
    })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      fileInputRef.current.files = files
      handleFileUpload({ target: { files } })
    }
  }

  return (
    <div 
      className="csv-upload"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button 
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Satellite CSV
        </button>
        <p>Drag & drop or click to upload</p>
        <p className="upload-hint">Supports 100+ satellites • CSV format required</p>
      </div>
    </div>
  )
}

export default CsvUpload
