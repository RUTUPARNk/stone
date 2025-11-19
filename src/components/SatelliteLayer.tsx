"use client"

import React from "react"
import { projectToSVG } from "../lib/coordinates"
import { SatelliteState } from "../lib/physicsBridge"

interface SatelliteLayerProps {
  width: number
  height: number
  satelliteStates: SatelliteState[]
  globeRotation?: { phi: number; theta: number }
  onSatelliteClick?: (state: SatelliteState) => void
}

export function SatelliteLayer({
  width,
  height,
  satelliteStates,
  globeRotation = { phi: 0, theta: 0.3 },
  onSatelliteClick,
}: SatelliteLayerProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 pointer-events-auto"
    >
      {satelliteStates.map((state) => {
        // Project using current globe rotation (returns null if on far side)
        const projected = projectToSVG(
          state.lat,
          state.lon,
          width,
          height,
          globeRotation.phi,
          globeRotation.theta
        )
        
        // Skip if on far side of globe
        if (!projected) return null
        
        const [x, y] = projected
        const color = state.color || "#ffffff"
        const size = Math.max(3, Math.min(8, (state.radius || 1) * 2))

        return (
          <g
            key={state.id}
            onClick={() => onSatelliteClick?.(state)}
            style={{ cursor: onSatelliteClick ? "pointer" : "default" }}
          >
            {/* Glow effect for close approaches */}
            {state.isCloseApproach && (
              <circle
                cx={x.toFixed(2)}
                cy={y.toFixed(2)}
                r={size * 2}
                fill={color}
                opacity="0.3"
                className="animate-pulse"
              />
            )}
            {/* Satellite marker */}
            <circle
              cx={x.toFixed(2)}
              cy={y.toFixed(2)}
              r={size}
              fill={color}
              stroke={state.isCloseApproach ? "#ff4444" : "rgba(255,255,255,0.5)"}
              strokeWidth={state.isCloseApproach ? 2 : 1}
            />
            {/* Satellite ID label (for larger satellites) */}
            {state.radius && state.radius > 2 && (
              <text
                x={(x + size + 3).toFixed(2)}
                y={y.toFixed(2)}
                fill={color}
                fontSize="10"
                fontFamily="monospace"
                pointerEvents="none"
              >
                {state.id}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

