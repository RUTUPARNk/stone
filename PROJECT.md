# stone — the story

He kept looking up.

[`moon`](../moon/PROJECT.md) was the first satellite project — *where are the
satellites right now*, pulled from live TLE data and dropped onto a spinning
globe. **`stone` is the same fascination, leveled up to the harder question:
*will they hit each other?***

This isn't plotting anymore — it's **simulation**. He wrote a custom orbital
`integrator` to propagate satellites forward through time, then built a
**two-phase conjunction detector** to catch collisions: a coarse *broad phase*
sweeps a time grid (every ~10 minutes, ~50 km threshold) to find which pairs could
possibly be close, then a *narrow phase* refines the candidates. That broad→narrow
structure isn't a toy choice — it's exactly how real space-situational-awareness
systems (and, not coincidentally, game collision engines) keep an O(n²) problem
tractable. He arrived at the right architecture for the real problem.

All of it drawn on a COBE globe with projected orbit paths, fed by CSV uploads of
satellite sets. The kid's-eye wonder of moon, rebuilt with the physics underneath
it.

## What it is

- `src/sim/integrator.js` — orbital propagation over time.
- `src/sim/twoPhaseDetector.js` + `detector.js` — broad/narrow-phase close-approach
  detection.
- `src/lib/coordinates.ts`, `physicsBridge.ts` — the coordinate/physics glue.
- `src/components/` — COBE globe, projected orbits, satellite/orbit layers,
  CSV upload, simulation view. React + TS + Vite, Vercel-deployed.

## Cleanup done in this pass (2026)

- Replaced the default `React + TypeScript + Vite` boilerplate README with a real
  description of what the app actually is. (Repo was otherwise clean — no committed
  deps or secrets.)
