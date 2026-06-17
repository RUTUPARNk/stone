# stone

A satellite **orbit simulator and conjunction (collision) detector** in the
browser. Propagate many satellites' orbits forward in time and flag dangerous
close approaches, visualized on a 3D globe.

- **Custom physics** — an orbital `integrator` propagates satellite positions over
  time; `coordinates`/`physicsBridge` handle the math.
- **Two-phase conjunction detection** (`twoPhaseDetector.js`) — a *broad phase*
  scans a coarse time grid (every ~10 min, ~50 km threshold) to find candidate
  pairs, then a *narrow phase* refines them. The same broad→narrow pattern real
  space-situational-awareness and collision systems use.
- **Visualization** — a COBE globe with projected orbits, a satellite layer, and an
  orbit canvas; CSV upload to load satellite sets; a simulation view.

React + TypeScript + Vite; deployed on Vercel.

## Run
```bash
npm install
npm run dev
```
