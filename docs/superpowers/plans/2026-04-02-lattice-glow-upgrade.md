# Lattice Glow Profile Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the lattice grid for non-cube shapes (octahedron, icosahedron, dodecahedron) visually match the cube's original "glowing tube" effect — same depth, brightness profile, and aesthetic.

**Architecture:** Replace the simple `(1-t²)²` glow profile in `buildLatticeGrid.genAxisTrace()` with the cube's exact `frame → SDF → pow(p,4)` profile. Also reduce overly-thick edge detection on non-cube shapes. All changes in `test-shapes.html` only.

**Tech Stack:** GLSL shaders generated via JavaScript in `test-shapes.html`

---

## What's Wrong Now (visual analysis)

The cube's `infiniteGrid` creates "glowing tubes" via a 5-step profile:
1. `frame = abs(uv-0.5) - 0.5 + glowWidth` — signed distance to cell edge
2. `s = SDF(frame) / glowWidth; s²` — normalized edge proximity
3. `f = 1 - 2*abs(uv-0.5)` — position along grid line (1=center, 0=edge)
4. `p = (3 - 2*max(f.x,f.y))⁴` — bright at line center, sharp falloff
5. `p *= s²` — combine edge distance with position

The lattice uses: `t = minD/glowWidth; p = (1-t²)²` — flat, no "tube" volume.

Also: `edgeDetect` for non-cube shapes uses `glowWidth*3.0` threshold (3x thicker than cube edges).

## File Map

- **Modify:** `test-shapes.html` — the `genAxisTrace()` function (lines ~247-287) and `edgeDetect` constants

---

### Task 1: Port cube glow profile into genAxisTrace

**Files:**
- Modify: `test-shapes.html` — `genAxisTrace()` function (~line 247)

- [ ] **Step 1: Replace the glow profile section in genAxisTrace**

Find the glow profile block (current simple version):
```javascript
    // Simple bounded glow profile [0,1]
    c += `                float ${vp}_t = ${vp}_minD / glowWidth;\n`;
    c += `                float ${vp}_p = 1.0 - ${vp}_t * ${vp}_t;\n`;
    c += `                ${vp}_p = ${vp}_p * ${vp}_p;\n`;
    c += `                ${vp}_p = mix(1.0, ${vp}_p, complexity);\n`;
```

Replace with the cube's profile adapted for N-axis lattice:
```javascript
    // Cube-quality glow profile adapted for lattice
    // For each other axis, compute frame (signed distance to cell edge)
    // and f (position along grid line: 1=center, 0=edge)
    c += `                float ${vp}_maxF = 0.0;\n`;
    c += `                float ${vp}_sdf = 0.0;\n`;
    for (const j of otherAxes) {
      // frame_j: signed distance to cell boundary (negative = inside glow band)
      c += `                { float uv_${j} = fract(${vp}_o${j});\n`;
      c += `                  float frame_${j} = abs(uv_${j} - 0.5) - 0.5 + glowWidth;\n`;
      c += `                  ${vp}_sdf = max(${vp}_sdf, frame_${j});\n`;
      // f_j: how far from cell edge (0=at edge, 1=at center)
      c += `                  float f_${j} = 1.0 - 2.0 * abs(uv_${j} - 0.5);\n`;
      c += `                  ${vp}_maxF = max(${vp}_maxF, f_${j}); }\n`;
    }
    // s: normalized edge distance (like cube's SDF-based s)
    c += `                float ${vp}_s = max(${vp}_sdf, 0.0) / glowWidth;\n`;
    c += `                ${vp}_s *= ${vp}_s;\n`;
    // p: brightness — bright at line center, sharp falloff (cube's pow4 profile)
    c += `                float ${vp}_p = 3.0 - 2.0 * ${vp}_maxF;\n`;
    c += `                ${vp}_p = pow(${vp}_p, 4.0);\n`;
    c += `                ${vp}_p *= ${vp}_s * ${vp}_s;\n`;
    c += `                ${vp}_p = max(${vp}_p, 0.0);\n`;
    c += `                ${vp}_p = mix(1.0, ${vp}_p, complexity);\n`;
```

- [ ] **Step 2: Screenshot cube in lattice dominant mode and compare with original**

Take screenshots of cube with `original` and `dominant` grid modes. They should now look much more similar — both showing "tube-like" glowing grid lines.

Run: headless Chrome screenshot of `test-auto.html?shape=cube&mode=original` and `test-auto.html?shape=cube&mode=dominant`

Expected: lattice cube now has thicker, brighter grid lines with volume, close to original.

- [ ] **Step 3: Screenshot all 4 shapes in dominant mode**

Run: headless Chrome screenshots for cube, octahedron, icosahedron, dodecahedron all in `dominant` mode.

Expected: All shapes show glowing grid lines with depth and volume. Octahedron shows triangular pattern, icosahedron/dodecahedron show their respective patterns, all with proper brightness falloff into depth.

- [ ] **Step 4: Commit**

```bash
git add test-shapes.html
git commit -m "feat: port cube glow profile to lattice grid — tube-like glowing lines for all shapes"
```

---

### Task 2: Reduce edge detection thickness for non-cube shapes

**Files:**
- Modify: `test-shapes.html` — `edgeDetect` in octahedron, icosahedron, dodecahedron shape definitions

- [ ] **Step 1: Change edge smoothstep threshold from glowWidth*3.0 to glowWidth*1.5**

In octahedron edgeDetect (~line 133):
```
OLD: return smoothstep(glowWidth*3.0, 0.0, mx-mx2) > 0.5 ? 1.0 : 0.0;
NEW: return smoothstep(glowWidth*1.5, 0.0, mx-mx2) > 0.5 ? 1.0 : 0.0;
```

Same change in icosahedron edgeDetect (~line 168) and dodecahedron edgeDetect (~line 198).

- [ ] **Step 2: Screenshot octahedron and compare**

Expected: edges are thinner, internal grid is more visible, grid lines now dominate over edge highlights.

- [ ] **Step 3: Commit**

```bash
git add test-shapes.html
git commit -m "fix: reduce edge thickness for non-cube shapes — let internal grid show through"
```

---

### Task 3: Visual tuning and verification

- [ ] **Step 1: Screenshot all 4 shapes side-by-side**

Take final screenshots of all shapes in dominant mode. Compare:
- Grid line brightness and volume (should look like glowing tubes)
- Depth falloff (should fade into darkness like the cube)
- Edge/grid balance (grid should be the star, edges just accent)
- Overall aesthetic consistency across shapes

- [ ] **Step 2: If needed — adjust glow/cellScale/edgeWidth per-shape**

Possible tweaks based on visual review:
- `cellScale`: if grid is too fine/coarse for a shape
- Edge threshold: further reduction if still too prominent
- Glow exponent: if depth falloff is too fast/slow

- [ ] **Step 3: Final commit**

```bash
git add test-shapes.html
git commit -m "polish: visual tuning of grid for all shapes"
```
