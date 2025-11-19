"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import createGlobe from "cobe";

/*
  GlobeWithProjectedOrbits.jsx

  Usage: just render <GlobeWithProjectedOrbits /> inside a client page.
  Requirements: place your CSV (satellites_100.csv) under /public so it's fetchable at runtime.
*/

const MU = 3.986004418e14;
const R_E = 6378137; // Earth radius in meters (used only for altitude calc)

/* ---------------------------
   Projection utilities
   ---------------------------
   - convert ECEF (x,y,z m) -> lat/lon (radians)
   - build 3D unit-sphere point for lat/lon
   - rotate 3D point by theta (x-axis) and phi (y-axis)
   - orthographic projection -> screen x,y
*/

function ecefToLatLon(x, y, z) {
  const rxy = Math.hypot(x, y);
  const lat = Math.atan2(z, rxy); // radians
  const lon = Math.atan2(y, x); // radians
  const alt = Math.hypot(x, y, z) - R_E;
  return { lat, lon, alt };
}

function latLonToUnit(lat, lon) {
  const cosLat = Math.cos(lat);
  return {
    x: cosLat * Math.cos(lon),
    y: cosLat * Math.sin(lon),
    z: Math.sin(lat),
  };
}

function rotatePoint(pt, theta, phi) {
  // theta: rotation around X axis (radians)
  // phi: rotation around Y axis (radians)
  // apply X-rotation, then Y-rotation
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const cosP = Math.cos(phi), sinP = Math.sin(phi);

  // rotate around X (theta)
  const x1 = pt.x;
  const y1 = pt.y * cosT - pt.z * sinT;
  const z1 = pt.y * sinT + pt.z * cosT;

  // rotate around Y (phi)
  const x2 = x1 * cosP + z1 * sinP;
  const y2 = y1;
  const z2 = -x1 * sinP + z1 * cosP;

  return { x: x2, y: y2, z: z2 };
}

function projectToScreen(ptRot, width, height, radiusPx = 0.42) {
  // Orthographic projection:
  // Only show if z (after rotation) > 0 (facing camera)
  // radiusPx is proportion of min(width,height) used as globe radius
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) * radiusPx;
  if (ptRot.z <= 0) return null;
  // x to right, y up -> screen y decreases for positive y
  const sx = cx + ptRot.x * R;
  const sy = cy - ptRot.y * R;
  return { x: sx, y: sy };
}

/* ---------------------------
   CSV parser (simple)
   ---------------------------
*/
async function fetchCSV(url) {
  const res = await fetch(url);
  const txt = await res.text();
  // simple CSV -> array of rows using first line headers
  const lines = txt.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map((ln) => {
    // split respecting quoted fields rudimentarily
    // we expect no embedded commas except P_cov_json; that's ok
    const parts = ln.split(",");
    // map first 10 expected fields (we ignore P_cov_json parsing here)
    const obj = {};
    for (let i = 0; i < headers.length && i < parts.length; i++) {
      obj[headers[i]] = parts[i].trim().replace(/^"|"$/g, "");
    }
    return obj;
  });
  return rows;
}

/* ---------------------------
   Orbit path builder
   ---------------------------
   Given one satellite ECEF position vector, approximate a ring path:
   - compute the normal (use position cross arbitrary vector)
   - build a circle in the orbital plane around Earth's center that passes near pos
   - sample N points and convert to lat/lon
   This is a visualization-friendly approximation (not a high-precision propagator).
*/
function buildOrbitRingFromEcef(x, y, z, samples = 160) {
  // If position near origin, bail
  const rNorm = Math.hypot(x, y, z);
  if (rNorm < 1) return [];

  // unit position
  const ux = x / rNorm, uy = y / rNorm, uz = z / rNorm;

  // choose arbitrary vector not colinear with u
  let ax = 0, ay = 0, az = 1;
  if (Math.abs(ux) < 0.1 && Math.abs(uy) < 0.1) {
    ax = 0; ay = 1; az = 0;
  }

  // orbital normal = cross(u, a)
  let nx = uy * az - uz * ay;
  let ny = uz * ax - ux * az;
  let nz = ux * ay - uy * ax;
  const nlen = Math.hypot(nx, ny, nz) || 1;
  nx /= nlen; ny /= nlen; nz /= nlen;

  // radius of orbit circle (distance to Earth's center)
  const R = rNorm;

  // find two orthonormal basis vectors in orbital plane
  // e1 = u (point direction normalized)
  const e1x = ux, e1y = uy, e1z = uz;
  // e2 = n cross e1
  let e2x = ny * e1z - nz * e1y;
  let e2y = nz * e1x - nx * e1z;
  let e2z = nx * e1y - ny * e1x;
  const e2len = Math.hypot(e2x, e2y, e2z) || 1;
  e2x /= e2len; e2y /= e2len; e2z /= e2len;

  // sample circle points in this plane centered at origin:
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const ang = (2 * Math.PI * i) / samples;
    const px = R * (Math.cos(ang) * e1x + Math.sin(ang) * e2x);
    const py = R * (Math.cos(ang) * e1y + Math.sin(ang) * e2y);
    const pz = R * (Math.cos(ang) * e1z + Math.sin(ang) * e2z);
    const { lat, lon } = ecefToLatLon(px, py, pz);
    pts.push({ lat, lon });
  }
  return pts;
}

/* ---------------------------
   Main component
   ---------------------------
*/
export default function GlobeWithProjectedOrbits({
  csvPath = "/satellites_100.csv",
  size = 600, // canvas size in px
}) {
  const canvasRef = useRef(null);
  const globeRef = useRef(null);
  const [phiTheta, setPhiTheta] = useState({ phi: 0.3, theta: 0.0 }); // tracked from COBE onRender
  const [satData, setSatData] = useState([]); // {id, x,y,z, lat, lon, orbitLatLon[]}
  const rafRef = useRef(null);
  const overlayRef = useRef(null);

  // load CSV once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchCSV(csvPath);

        // parse rows -> satellite objects
        const sats = rows.map((r, idx) => {
          const x = parseFloat(r.x_m) || 0;
          const y = parseFloat(r.y_m) || 0;
          const z = parseFloat(r.z_m) || 0;
          const id = r.sat_id || `S${idx + 1}`;
          const geo = ecefToLatLon(x, y, z);
          const orbitLatLon = buildOrbitRingFromEcef(x, y, z, 180);

          return {
            id,
            x, y, z,
            lat: geo.lat,
            lon: geo.lon,
            alt: geo.alt,
            orbitLatLon, // array of {lat,lon}
          };
        });

        if (!mounted) return;
        setSatData(sats);
      } catch (e) {
        console.error("Failed to load CSV", e);
      }
    })();

    return () => (mounted = false);
  }, [csvPath]);

  // initialize COBE globe
  useEffect(() => {
    function onRender(state) {
      // state.phi, state.theta are provided by COBE
      setPhiTheta({ phi: state.phi, theta: state.theta });
      // small hook for globe internal adjustments if needed
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = size;
    const height = size;

    const globe = createGlobe(canvas, {
      width,
      height,
      devicePixelRatio: 2,
      phi: 0.3,
      theta: 0,
      dark: 0,
      diffuse: 0.4,
      mapSamples: 16000,
      mapBrightness: 1.2,
      baseColor: [0.05, 0.05, 0.06], // darkish
      markerColor: [0.98, 0.39, 0.08],
      glowColor: [0.9, 0.9, 0.9],
      onRender,
    });
    globeRef.current = globe;

    // ensure canvas is visible
    canvas.style.opacity = "1";

    return () => {
      try {
        globe.destroy();
      } catch (_) {}
      globeRef.current = null;
    };
  }, [size]);

  // main animation loop to reproject overlays each frame (uses phi/theta state)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    let mounted = true;

    function draw() {
      if (!mounted) return;
      // width/height for projection
      const rect = overlay.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Build orbit SVG paths and satellite markers each frame by re-projecting lat/lon
      // Orbits are reprojected (but not re-sampled) – we keep orbitLatLon static (lat/lon)
      const orbitsGroup = overlay.querySelector("#orbit-paths");
      const satsGroup = overlay.querySelector("#sat-markers");
      if (!orbitsGroup || !satsGroup) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Clear children (we'll recreate). This is fine for moderate counts (100).
      orbitsGroup.innerHTML = "";
      satsGroup.innerHTML = "";

      const phi = phiTheta.phi || 0;
      const theta = phiTheta.theta || 0;

      // draw orbits
      satData.forEach((s, idx) => {
        if (!s.orbitLatLon || s.orbitLatLon.length === 0) return;
        const pts = [];
        for (let i = 0; i < s.orbitLatLon.length; i++) {
          const { lat, lon } = s.orbitLatLon[i];
          const unit = latLonToUnit(lat, lon);
          const rotated = rotatePoint(unit, theta, phi);
          const pr = projectToScreen(rotated, w, h);
          if (pr) pts.push(pr);
        }
        if (pts.length < 2) return;
        // build path d
        let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
        for (let j = 1; j < pts.length; j++) {
          d += ` L ${pts[j].x.toFixed(2)} ${pts[j].y.toFixed(2)}`;
        }
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke", "rgba(150,150,250,0.85)");
        path.setAttribute("stroke-width", "1");
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", "0.55");
        orbitsGroup.appendChild(path);
      });

      // draw satellites (current sample point: take orbit[0] as current pos for demo)
      satData.forEach((s) => {
        // choose a current lat/lon to display as satellite; here pick the original lat/lon
        const unit = latLonToUnit(s.lat, s.lon);
        const rotated = rotatePoint(unit, theta, phi);
        const pr = projectToScreen(rotated, w, h);
        if (!pr) return; // on far side

        // circle
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", pr.x.toFixed(2));
        c.setAttribute("cy", pr.y.toFixed(2));
        c.setAttribute("r", "4");
        c.setAttribute("fill", "rgba(60,200,80,0.95)");
        c.setAttribute("stroke", "white");
        c.setAttribute("stroke-width", "0.6");
        satsGroup.appendChild(c);

        // optional label
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", (pr.x + 8).toFixed(2));
        txt.setAttribute("y", (pr.y + 2).toFixed(2));
        txt.setAttribute("font-size", "10");
        txt.setAttribute("fill", "rgba(180,220,255,0.95)");
        txt.setAttribute("pointer-events", "none");
        txt.textContent = s.id;
        satsGroup.appendChild(txt);
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [satData, phiTheta]);

  // container style
  const wrapperStyle = {
    position: "relative",
    width: `${size}px`,
    height: `${size}px`,
  };

  const canvasStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    transition: "opacity 0.3s",
    willChange: "transform",
  };

  const svgStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
  };

  return (
    <div style={wrapperStyle}>
      <canvas ref={canvasRef} width={size} height={size} style={canvasStyle} />
      <svg
        ref={overlayRef}
        style={svgStyle}
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g id="orbit-paths" />
        <g id="sat-markers" />
      </svg>
    </div>
  );
}

