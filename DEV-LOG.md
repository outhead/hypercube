# Shape Grid Development Log

## Goal
Build a WebGL hero scene. Glass shapes (cube, octahedron, etc.) with internal glowing grid that matches shape geometry.

## Current State (2026-03-31)
- **index.html** — main hero page with cube, tower, particles, aurora ribbons, halo, bloom, fluid
- **test-shapes.html** — isolated lab for testing grid algorithms on different shapes

## Key Problem
The cube's internal grid (nested squares receding into depth) needs to work for other shapes too:
- Octahedron → nested triangles
- Icosahedron → pentagons
- Dodecahedron → pentagons

## What Works
- Cube grid: baseline algorithm with 3 axes (X,Y,Z), square fract() check, Chebyshev depth. Perfect.
- Shape SDF intersection, normals, edge detection for all 4 shapes.
- getEnv (area light via lightMatrix), fresnel, refraction — all universal.

## Approaches Tried & Results

### 1. Per-face tangent frame + tiling patterns (FAILED)
- Built tangent frame (t1, t2) per face normal
- Applied triangle/hex tiling in 2D on each face plane
- **Problem**: each face has different tangent frame orientation → grid rotates when switching faces
- Tried edgeTangents (explicit edge directions) — still inconsistent across faces
- Tried gridRotation slider — worked for ONE face (30 deg for octahedron) but wrong on others

### 2. "Dominant" mode — trace only 1 face normal (PARTIAL)
- Pick face normal most aligned with refracted ray
- Square tiling at small cell scale → looked like triangles! "Image #17: сильно ближе"
- **Problem**: tangent frame still causes rotation per face. Would need per-face rotation = hardcoded.

### 3. Full lattice — all axes + cube algorithm (TOO DENSE)
- Trace ALL face normals, on each plane check OTHER coordinates via fract()
- Mathematically proven: octahedron lattice creates triangular lines at 120 degrees
- **Problem**: 4 axes × 3 other-axis checks = 12 line instances (cube has 3×2=6). Too cluttered.
- Also: threshold was glowWidth*3 (should be glowWidth like cube) and glow profile was wrong.

### 4. Dominant lattice — CURRENT APPROACH (testing)
- Pick dominant axis (like #2), but check OTHER coordinates via lattice math (like #3)
- NO tangent frames → no rotation bug
- Global lattice coordinates → consistent across all faces
- 1 axis family × 3 other-axis checks = 3 line directions = same density as cube
- Glow profile: matched to cube's exact formula
- **Status**: code written, needs visual testing

## Architecture: How the Cube Grid Works

7 layers in the shader:
1. **Intersection**: raymarched SDF or analytic AABB
2. **Normal**: SDF gradient or analytic
3. **Fresnel**: pow(1-cosI, 3) — universal
4. **infiniteGrid**: traces ray through plane families, checks 2D grid on each plane
5. **getEnv**: fake rectangular area light via lightMatrix — universal
6. **Edge detection**: where 2+ face boundaries meet — shape-specific
7. **Refraction**: Snell's law → refracted ray into grid or env — universal

Only #1, #4, #6 need per-shape adaptation. Rest is universal.

## Key Math Insight
For octahedron with normals N0=(1,1,1)/sqrt3, N1=(1,1,-1)/sqrt3, N2=(1,-1,1)/sqrt3, N3=(-1,1,1)/sqrt3:
- On any face's plane, the OTHER 3 normal families create lines at exactly 120 degrees apart
- This is proven: N0×N1, N0×N2, N0×N3 are all at 120 degrees pairwise
- So checking fract(u_j) for other axes on a dominant face plane gives a TRIANGULAR grid automatically

## Files
- `/test-shapes.html` — Shape Grid Lab v2 with lattice approach
- `/index.html` — main hero page (cube-only grid currently)

## Physics & Math Laws Used

### Snell's Law (Refraction)
`refDir = normalize(nor * (sqrt(cosI² + eta² - 1) + cosI) - rd)`
Computes direction of light ray passing through glass. eta (IOR) controls how much the ray bends. Higher eta = more bending = see different internal structure from different angles.

### Fresnel Effect
`pow(1.0 - abs(dot(rd, normal)), 3.0)`
At shallow angles, glass reflects more light (edges bright). At perpendicular angles, more light passes through (center transparent). This creates the natural "glass edge highlight" look.

### Chebyshev Distance (Depth Metric)
`max(|floor(x)|, |floor(y)|)` for cube, `max(|floor(u_i)|)` for lattice.
Creates concentric rings: squares for cube, hexagons for octahedron. Unlike Euclidean distance (circles), Chebyshev produces shapes matching the grid geometry. Used with `pow(glow, depth)` for exponential falloff.

### Cross Product Geometry (Lattice Line Directions)
For any two face normals N_i, N_j of a polyhedron, their cross product N_i × N_j gives the direction of grid lines at the intersection of their plane families. For octahedron: all 6 pairs give edges at exactly 120° on each face → equilateral triangle grid emerges automatically.

### Plane-Ray Intersection (Grid Stepping)
`d = (target - dot(ro, N) * sc) / (dot(rd, N) * sc)`
Steps a ray through equally-spaced parallel planes perpendicular to face normal N. At each plane, checks if OTHER axis coordinates are near integer boundaries → detects grid lines.

### Dual Polyhedra & Lattice Correspondence
- Cube (3 axes, 2 checks/plane) → square grid on each face
- Octahedron (4 axes, 3 checks/plane) → triangular grid (because 3 line sets at 120°)
- Icosahedron (6 axes, 5 checks/plane) → pentagonal patterns
- Dodecahedron (6 axes, 5 checks/plane) → pentagonal patterns
The grid pattern on each face is determined by how OTHER normal families project onto that face's plane.

### Area Light Approximation
`getEnv()`: ray-plane intersection at z=0, `pos = 1 - pos²` creates squircle vignette.
Fakes a rectangular area light without actual ray tracing. The lightMatrix transforms ray to light space, creating bright rectangular reflections on glass surfaces.

## Approach #4 Status Update (2026-03-31)
- Dominant lattice works: octahedron shows triangles, icosahedron shows pentagonal patterns
- Cube uses the baseline algorithm (proven perfect)
- Auto-switching: cube→baseline, others→dominant lattice
- +0.5 centering offset added for symmetric depth
- Profile still needs work for non-cube shapes (lines too dim)

## Target Parameter Reference
Values chosen for the hero scene (all independently tunable via the in-app panel):
- Cube shader: envIntensity=5, glowWidth=0.025, glow=0.64, eta=1.75, lightColor=#d49c4d
- Aurora: 3D TubeGeometry ribbons, 3-frequency simplex noise, default color (0.385, 0.50, 0.861)
- Particles: 4096 (64x64 GPU compute), focus=0.9, focusDistance=3, size=0.01
- Renderer: alpha:true, toneMapping exposure=0.65, no fog, no standard lights
- Halo: chromatic aberration on mirrored bloom levels
- Fluid: barrel distortion + iridescence LUT overlay
