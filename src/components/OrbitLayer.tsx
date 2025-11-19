"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { projectToSVG, buildOrbitRingFromEcef } from "../lib/coordinates"
import { SatelliteState } from "../lib/physicsBridge"

interface OrbitLayerProps {
  width: number
  height: number
  satelliteStates: SatelliteState[]
  globeRotation?: { phi: number; theta: number }
}

export function OrbitLayer({
  width,
  height,
  satelliteStates,
  globeRotation = { phi: 0, theta: 0.3 },
}: OrbitLayerProps) {
  // Store orbit samples in lat/lon (static geometry)
  const orbitSamples = useMemo(() => {
    const samples: Map<string, Array<[number, number]>> = new Map()

    satelliteStates.forEach((state) => {
      // Generate orbit path points in lat/lon
      const numPoints = 128
      const points: Array<[number, number]> = []

      // Calculate orbital radius
      const r = Math.sqrt(
        state.xyz_ecef[0] ** 2 +
          state.xyz_ecef[1] ** 2 +
          state.xyz_ecef[2] ** 2
      )

      // Use the improved orbit ring builder
      const orbitPoints = buildOrbitRingFromEcef(
        state.xyz_ecef[0],
        state.xyz_ecef[1],
        state.xyz_ecef[2],
        numPoints
      )
      points.push(...orbitPoints)

      samples.set(state.id, points)
    })

    return samples
  }, [satelliteStates])

  // Project orbit samples to screen coordinates using current globe rotation
  const orbitPaths = useMemo(() => {
    const paths: Map<string, string> = new Map()
    const { phi, theta } = globeRotation

    orbitSamples.forEach((points, id) => {
      // Project all points using current phi and theta
      const projectedPoints: Array<[number, number]> = []
      for (let i = 0; i < points.length; i++) {
        const [lat, lon] = points[i]
        const projected = projectToSVG(lat, lon, width, height, phi, theta)
        if (projected) {
          projectedPoints.push(projected)
        }
      }

      // Build SVG path string (only if we have visible points)
      if (projectedPoints.length >= 2) {
        let d = `M ${projectedPoints[0][0].toFixed(2)},${projectedPoints[0][1].toFixed(2)}`
        for (let i = 1; i < projectedPoints.length; i++) {
          d += ` L ${projectedPoints[i][0].toFixed(2)},${projectedPoints[i][1].toFixed(2)}`
        }
        // Close the path
        d += ` Z`
        paths.set(id, d)
      }
    })

    return paths
  }, [orbitSamples, width, height, globeRotation])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 pointer-events-none"
    >
      <defs>
        {satelliteStates.map((state) => {
          const color = state?.color || "#2EB9DF"
          const gradientId = `orbit-gradient-${state.id}`

          return (
            <linearGradient key={gradientId} id={gradientId} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="50%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor="#9E00FF" stopOpacity="0" />
            </linearGradient>
          )
        })}
      </defs>
      
      {Array.from(orbitPaths.entries()).map(([id, path]) => {
        const state = satelliteStates.find((s) => s.id === id)
        const color = state?.color || "#2EB9DF"
        const gradientId = `orbit-gradient-${id}`

        return (
          <g key={id}>
            {/* Base path (subtle) */}
            <path
              d={path}
              stroke={color}
              strokeOpacity="0.1"
              strokeWidth="1"
              fill="none"
            />
            {/* Animated gradient path */}
            <motion.path
              d={path}
              stroke={`url(#${gradientId})`}
              strokeLinecap="round"
              strokeWidth="1.5"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: [0, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </g>
        )
      })}
    </svg>
  )
}

