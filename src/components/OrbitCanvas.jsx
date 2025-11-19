import React, { useRef, useEffect, useCallback, useState } from 'react'
import { calculateDistance } from '../sim/detector'
import './OrbitCanvas.css'

const OrbitCanvas = ({ 
  satellites, 
  conjunctions, 
  viewMode = 'XY', 
  onSatelliteClick
}) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const animationRef = useRef(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  // Update canvas size when container resizes
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current
        const width = Math.min(container.clientWidth - 40, 1200) // Max width with padding
        const height = Math.min(container.clientHeight - 40, 800) // Max height with padding
        
        setCanvasSize({ 
          width: Math.max(width, 400), // Minimum width
          height: Math.max(height, 300) // Minimum height
        })
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Project 3D coordinates to 2D based on view mode
  const projectTo2D = useCallback((position, view) => {
    const [x, y, z] = position
    switch (view) {
      case 'XY': return { x, y }
      case 'XZ': return { x, y: z }
      case 'YZ': return { x: y, y: z }
      default: return { x, y }
    }
  }, [])

  // Scale coordinates to fit canvas
  const scaleCoordinates = useCallback((satellites, viewMode, canvasWidth, canvasHeight) => {
    if (!satellites.length) return { scale: 1, centerX: canvasWidth / 2, centerY: canvasHeight / 2 }

    // Find maximum orbital radius for scaling
    let maxR = 0
    satellites.forEach(sat => {
      const projected = projectTo2D(sat.position, viewMode)
      const r = Math.sqrt(projected.x ** 2 + projected.y ** 2)
      maxR = Math.max(maxR, r)
    })

    // Add Earth radius (6378137m) and some padding
    const earthRadius = 6378137
    maxR = Math.max(maxR, earthRadius * 1.5)
    
    // Calculate scale factor (90% of canvas)
    const scale = (Math.min(canvasWidth, canvasHeight) / (2 * maxR)) * 0.9
    
    return {
      scale,
      centerX: canvasWidth / 2,
      centerY: canvasHeight / 2,
      earthRadius: earthRadius * scale
    }
  }, [projectTo2D])

  // Draw close approaches with distance labels
  const drawCloseApproaches = useCallback((ctx, satellites, viewMode, transform, threshold = 100000) => {
    const { scale, centerX, centerY } = transform
    
    ctx.strokeStyle = '#ffff00'
    ctx.setLineDash([2, 2])
    ctx.lineWidth = 1
    ctx.fillStyle = '#ffff00'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    
    for (let i = 0; i < satellites.length; i++) {
      for (let j = i + 1; j < satellites.length; j++) {
        const sat1 = satellites[i]
        const sat2 = satellites[j]
        const distance = calculateDistance(sat1, sat2)
        
        if (distance < threshold) {
          const proj1 = projectTo2D(sat1.position, viewMode)
          const proj2 = projectTo2D(sat2.position, viewMode)
          
          const x1 = centerX + proj1.x * scale
          const y1 = centerY - proj1.y * scale
          const x2 = centerX + proj2.x * scale
          const y2 = centerY - proj2.y * scale
          
          // Draw line
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          
          // Add distance label
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2
          ctx.fillText(`${(distance/1000).toFixed(1)}km`, midX + 5, midY - 5)
        }
      }
    }
    ctx.setLineDash([])
  }, [projectTo2D])

  // Draw the complete scene
  const drawScene = useCallback((ctx, satellites, conjunctions, viewMode, transform) => {
    const { scale, centerX, centerY, earthRadius } = transform
    
    // Clear canvas with space background
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Draw coordinate axes
    ctx.strokeStyle = '#333344'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, ctx.canvas.height)
    ctx.moveTo(0, centerY)
    ctx.lineTo(ctx.canvas.width, centerY)
    ctx.stroke()

    // Draw Earth as wireframe circle
    ctx.strokeStyle = '#223377'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, earthRadius, 0, 2 * Math.PI)
    ctx.stroke()

    // Draw satellite orbits (simplified - just circles)
    ctx.strokeStyle = '#334455'
    ctx.lineWidth = 0.5
    satellites.forEach(satellite => {
      const projected = projectTo2D(satellite.position, viewMode)
      const orbitRadius = Math.sqrt(projected.x ** 2 + projected.y ** 2) * scale
      ctx.beginPath()
      ctx.arc(centerX, centerY, orbitRadius, 0, 2 * Math.PI)
      ctx.stroke()
    })

    // Draw close approaches with distance labels
    drawCloseApproaches(ctx, satellites, viewMode, transform, 50000)

    // Draw satellites as colored points
    satellites.forEach(satellite => {
      const projected = projectTo2D(satellite.position, viewMode)
      const canvasX = centerX + projected.x * scale
      const canvasY = centerY - projected.y * scale // Invert Y for canvas coordinates

      // Draw satellite point
      ctx.fillStyle = satellite.color || '#ffffff'
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, 3, 0, 2 * Math.PI)
      ctx.fill()

      // Draw satellite ID for larger satellites
      if (satellite.radius > 2) {
        ctx.fillStyle = '#ffffff'
        ctx.font = '10px monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(satellite.id, canvasX + 5, canvasY - 5)
      }
    })

    // Draw conjunction warnings
    conjunctions.forEach(conjunction => {
      const sat1 = satellites.find(s => s.id === conjunction.sat1)
      const sat2 = satellites.find(s => s.id === conjunction.sat2)
      
      if (sat1 && sat2) {
        const proj1 = projectTo2D(sat1.position, viewMode)
        const proj2 = projectTo2D(sat2.position, viewMode)
        
        const x1 = centerX + proj1.x * scale
        const y1 = centerY - proj1.y * scale
        const x2 = centerX + proj2.x * scale
        const y2 = centerY - proj2.y * scale

        // Draw warning line between satellites
        ctx.strokeStyle = conjunction.severity === 'CRITICAL' ? '#ff4444' : '#ffaa00'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 3])
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
        ctx.setLineDash([])

        // Draw warning indicator at midpoint
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        
        ctx.fillStyle = conjunction.severity === 'CRITICAL' ? '#ff4444' : '#ffaa00'
        ctx.beginPath()
        ctx.arc(midX, midY, 6, 0, 2 * Math.PI)
        ctx.fill()
      }
    })

    // Draw view mode label
    ctx.fillStyle = '#666688'
    ctx.font = '12px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`View: ${viewMode} Plane`, ctx.canvas.width - 10, 10)
  }, [projectTo2D, drawCloseApproaches])

  // Main drawing effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const transform = scaleCoordinates(satellites, viewMode, canvasSize.width, canvasSize.height)
    
    drawScene(ctx, satellites, conjunctions, viewMode, transform)
  }, [satellites, conjunctions, viewMode, canvasSize, drawScene, scaleCoordinates])

  // Handle canvas click for satellite selection
  const handleCanvasClick = useCallback((event) => {
    const canvas = canvasRef.current
    if (!canvas || !onSatelliteClick) return

    const rect = canvas.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    const transform = scaleCoordinates(satellites, viewMode, canvasSize.width, canvasSize.height)
    const { scale, centerX, centerY } = transform

    // Find clicked satellite
    for (const satellite of satellites) {
      const projected = projectTo2D(satellite.position, viewMode)
      const canvasX = centerX + projected.x * scale
      const canvasY = centerY - projected.y * scale
      
      const distance = Math.sqrt((clickX - canvasX) ** 2 + (clickY - canvasY) ** 2)
      
      // Click threshold: 8 pixels
      if (distance < 8) {
        onSatelliteClick(satellite)
        break
      }
    }
  }, [satellites, viewMode, canvasSize, onSatelliteClick, projectTo2D, scaleCoordinates])

  return (
    <div 
      ref={containerRef}
      className="orbit-canvas"
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleCanvasClick}
        className="orbit-canvas"
      />
    </div>
  )
}

export default OrbitCanvas
