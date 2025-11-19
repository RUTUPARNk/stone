"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { COBEGlobe, GlobeRotation } from "./COBEGlobe"
import { OrbitLayer } from "./OrbitLayer"
import { SatelliteLayer } from "./SatelliteLayer"
import { convertSatellitesToStates, SatelliteState } from "../lib/physicsBridge"
import { cn } from "../lib/utils"
import "./GlobeSystem.css"

interface GlobeSystemProps {
  satellites: any[] // Raw satellite data from simulation
  conjunctions?: any[]
  className?: string
  onSatelliteClick?: (state: SatelliteState) => void
}

export function GlobeSystem({
  satellites,
  conjunctions = [],
  className,
  onSatelliteClick,
}: GlobeSystemProps) {
  const [globeRotation, setGlobeRotation] = useState<GlobeRotation>({
    phi: 0,
    theta: 0.3,
  })
  const [satelliteStates, setSatelliteStates] = useState<SatelliteState[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 })

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const size = Math.min(rect.width, rect.height, 800)
        setDimensions({ width: size, height: size })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Convert satellites to states whenever satellites change
  useEffect(() => {
    if (satellites.length > 0) {
      const states = convertSatellitesToStates(satellites)
      setSatelliteStates(states)
    } else {
      setSatelliteStates([])
    }
  }, [satellites])

  // Handle rotation changes from COBE
  const handleRotationChange = useCallback((rotation: GlobeRotation) => {
    setGlobeRotation(rotation)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn("globe-wrapper", className)}
      style={{ width: "100%", height: "100%" }}
    >
      {/* COBE Earth Layer */}
      <COBEGlobe
        onRotationChange={handleRotationChange}
        className="globe-canvas"
      />

      {/* Orbit Layer (SVG) */}
      {satelliteStates.length > 0 && (
        <OrbitLayer
          width={dimensions.width}
          height={dimensions.height}
          satelliteStates={satelliteStates}
          globeRotation={globeRotation}
        />
      )}

      {/* Satellite Layer (SVG) */}
      {satelliteStates.length > 0 && (
        <SatelliteLayer
          width={dimensions.width}
          height={dimensions.height}
          satelliteStates={satelliteStates}
          globeRotation={globeRotation}
          onSatelliteClick={onSatelliteClick}
        />
      )}
    </div>
  )
}

