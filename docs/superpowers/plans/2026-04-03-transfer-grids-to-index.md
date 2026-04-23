# Transfer Shape Grids to Main Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the lattice grid (with cube-quality glow, depth, glass effects) for all shapes on the main index.html page — matching the working test-shapes.html implementation.

**Architecture:** Port the `buildLatticeGrid()` JS function from test-shapes.html into index.html's `buildFragmentShader()`. Each shape gets a dynamically generated lattice grid GLSL function injected alongside its SDF. Update SHAPE_META to enable grids for all shapes. Update icosahedron SDF to use 10 normals for correct shape. Thin edge detection for non-cube shapes.

**Tech Stack:** Three.js r172, GLSL ES, vanilla JS

---

### File Map

- **Modify:** `index.html`
  - `SHAPE_META` (~line 1996) — enable grids
  - `SDF_FUNCTIONS.icosahedron` (~line 1601) — new 10-normal SDF + 4-axis grid normals
  - `SDF_FUNCTIONS.octahedron` (~line 1586) — thin edge detection
  - `SDF_FUNCTIONS.icosahedron` (~line 1631) — new edge detection for 10 normals
  - `SDF_FUNCTIONS.dodecahedron` (~line 1682) — thin edge detection
  - `buildFragmentShader()` (~line 2005) — inject lattice grid + shape-specific grid config
  - `setShape()` (~line 2647) — always enable grid

---

### Task 1: Add buildLatticeGrid function to index.html

**Files:**
- Modify: `index.html` — insert before `buildFragmentShader()` (~line 2004)

- [ ] **Step 1: Add SHAPE_GRID_CONFIG and buildLatticeGrid**

Insert this block right before the `function buildFragmentShader(shapeName)` line (~2005):

```javascript
  // Shape grid configurations: faceNormals + apothem for lattice grid
  const SHAPE_GRID_CONFIG = {
    octahedron: {
      apothem: 0.26,
      faceNormals: [[1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]],
      linesPerAxis: 3,
    },
    icosahedron: {
      apothem: 0.35,
      // Grid uses octahedral lattice (4 axes) for clean triangular pattern
      faceNormals: [[1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]],
      linesPerAxis: 3,
    },
    dodecahedron: {
      apothem: 0.38,
      faceNormals: [[0,1,1.618],[0,-1,1.618],[1.618,0,1],[-1.618,0,1],[1,1.618,0],[-1,1.618,0]],
      linesPerAxis: 5,
    },
    stellated: {
      apothem: 0.35,
      faceNormals: [[1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]],
      linesPerAxis: 3,
    },
    compound: {
      apothem: 0.4,
      faceNormals: [[1,0,0],[0,1,0],[0,0,1]],
      linesPerAxis: 2,
    },
  };

  function buildLatticeGrid(config) {
    const normals = config.faceNormals;
    const K = normals.length;
    const h = config.apothem;
    const norms = normals.map(([x,y,z]) => {
      const l = Math.sqrt(x*x+y*y+z*z);
      return [x/l, y/l, z/l];
    });
    const sortedOthers = [];
    for (let i = 0; i < K; i++) {
      const dots = [];
      for (let j = 0; j < K; j++) {
        if (j === i) continue;
        const d = Math.abs(norms[i][0]*norms[j][0] + norms[i][1]*norms[j][1] + norms[i][2]*norms[j][2]);
        dots.push({j, d});
      }
      dots.sort((a,b) => a.d - b.d);
      sortedOthers[i] = dots.map(d => d.j);
    }
    let code = '';
    for (let i = 0; i < K; i++) {
      const [nx,ny,nz] = norms[i];
      code += `const vec3 LN${i} = vec3(${nx.toFixed(8)}, ${ny.toFixed(8)}, ${nz.toFixed(8)});\n`;
    }
    function genAxisTrace(axisIdx, otherAxes, vp) {
      let c = `
        float rdN_${vp} = dot(rd, LN${axisIdx}) * sc;
        if (abs(rdN_${vp}) > 0.001) {
          float roN_${vp} = dot(ro, LN${axisIdx}) * sc;
          float sz_${vp} = rdN_${vp} < 0.0 ? -1.0 : 1.0;
          float d_${vp} = (glowWidth - 0.5 - roN_${vp} * sz_${vp}) / (rdN_${vp} * sz_${vp});
          if (d_${vp} < 0.0) {\n`;
      for (const j of otherAxes) {
        c += `            float ${vp}_o${j} = dot(ro, LN${j}) * sc + dot(rd, LN${j}) * sc * d_${vp} + 0.5;\n`;
        c += `            float ${vp}_s${j} = -dot(rd, LN${j}) * sc / (rdN_${vp} * sz_${vp});\n`;
      }
      c += `            for (float ${vp}_i = 0.0; ${vp}_i < STEPS; ${vp}_i++) {\n`;
      c += `              float ${vp}_minD = 1.0;\n`;
      for (const j of otherAxes) {
        c += `              { float fv = fract(${vp}_o${j}); ${vp}_minD = min(${vp}_minD, min(fv, 1.0-fv)); }\n`;
      }
      c += `              if (${vp}_minD <= glowWidth) {\n`;
      c += `                float ${vp}_mc = 0.0;\n`;
      for (const j of otherAxes) {
        c += `                ${vp}_mc = max(${vp}_mc, abs(floor(${vp}_o${j})));\n`;
      }
      c += `                float ${vp}_v = ${vp}_mc + ${vp}_i;\n`;
      c += `                float ${vp}_maxF = 0.0;\n`;
      c += `                float ${vp}_sdf = -1.0;\n`;
      for (const j of otherAxes) {
        c += `                { float uv_${j} = fract(${vp}_o${j});\n`;
        c += `                  float frame_${j} = abs(uv_${j} - 0.5) - 0.5 + glowWidth;\n`;
        c += `                  ${vp}_sdf = max(${vp}_sdf, frame_${j});\n`;
        c += `                  float f_${j} = 1.0 - 2.0 * abs(uv_${j} - 0.5);\n`;
        c += `                  ${vp}_maxF = max(${vp}_maxF, f_${j}); }\n`;
      }
      c += `                float ${vp}_s = max(${vp}_sdf, 0.0) / glowWidth;\n`;
      c += `                ${vp}_s *= ${vp}_s;\n`;
      c += `                float ${vp}_p = 3.0 - 2.0 * ${vp}_maxF;\n`;
      c += `                ${vp}_p = pow(${vp}_p, 4.0);\n`;
      c += `                ${vp}_p *= ${vp}_s * ${vp}_s;\n`;
      c += `                ${vp}_p = max(${vp}_p, 0.0);\n`;
      c += `                ${vp}_p = mix(1.0, ${vp}_p, complexity);\n`;
      c += `                if (${vp}_v < bestV) { bestV = ${vp}_v; bestP = ${vp}_p; }\n`;
      c += `                break;\n`;
      c += `              }\n`;
      for (const j of otherAxes) {
        c += `              ${vp}_o${j} += ${vp}_s${j};\n`;
      }
      c += `            }\n`;
      c += `          }\n`;
      c += `        }\n`;
      return c;
    }
    code += `
    vec3 latticeGrid(vec3 ro, vec3 rd) {
      float sc = 0.5 / (${h.toFixed(6)} * cellScale);
      float bestV = 20.0;
      float bestP = 0.0;\n`;
    const lpa = Math.min(config.linesPerAxis || (K - 1), K - 1);
    for (let i = 0; i < K; i++) {
      const others = sortedOthers[i].slice(0, lpa);
      code += `      {\n`;
      code += genAxisTrace(i, others, `a${i}`);
      code += `      }\n`;
    }
    code += `
      return vec3(bestV, 0.0, bestP);
    }`;
    return code;
  }
```

- [ ] **Step 2: Verify no syntax errors**

Open `http://localhost:8765/index.html`, open console, switch to any non-cube shape. Should compile without errors (grid won't show yet — that's Task 3).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add buildLatticeGrid function to index.html"
```

---

### Task 2: Update icosahedron SDF to 10-normal true shape + thin edges

**Files:**
- Modify: `index.html` — `SDF_FUNCTIONS.icosahedron` (~line 1601)

- [ ] **Step 1: Replace icosahedron SDF with 10-normal version**

Replace the entire `icosahedron: \`...\`` block (lines 1601-1649) with:

```javascript
    icosahedron: `
      #define PHI 1.618033988749895
      #define IP 0.618033988749895
      float icoSDF(vec3 p) {
        float d = 0.0;
        d = max(d, abs(dot(p, normalize(vec3(1,1,1)))));
        d = max(d, abs(dot(p, normalize(vec3(1,1,-1)))));
        d = max(d, abs(dot(p, normalize(vec3(1,-1,1)))));
        d = max(d, abs(dot(p, normalize(vec3(-1,1,1)))));
        d = max(d, abs(dot(p, normalize(vec3(0,IP,PHI)))));
        d = max(d, abs(dot(p, normalize(vec3(0,IP,-PHI)))));
        d = max(d, abs(dot(p, normalize(vec3(IP,PHI,0)))));
        d = max(d, abs(dot(p, normalize(vec3(IP,-PHI,0)))));
        d = max(d, abs(dot(p, normalize(vec3(PHI,0,IP)))));
        d = max(d, abs(dot(p, normalize(vec3(PHI,0,-IP)))));
        return d - 0.35;
      }
      float shapeSDF(vec3 p) { return icoSDF(p); }
      vec3 shapeNormal(vec3 p) {
        vec2 e = vec2(0.0005, 0.0);
        return normalize(vec3(
          shapeSDF(p+e.xyy)-shapeSDF(p-e.xyy),
          shapeSDF(p+e.yxy)-shapeSDF(p-e.yxy),
          shapeSDF(p+e.yyx)-shapeSDF(p-e.yyx)));
      }
      float shapeIntersect(vec3 ro, vec3 rd) {
        float t = 0.0;
        for(int i=0; i<80; i++) {
          float d = shapeSDF(ro + rd*t);
          if(d < 0.001) return t;
          if(t > 5.0) break;
          t += d * 0.7;
        }
        return -1.0;
      }
      float shapeEdge(vec3 p) {
        float ds[10];
        ds[0]=abs(dot(p,normalize(vec3(1,1,1))));
        ds[1]=abs(dot(p,normalize(vec3(1,1,-1))));
        ds[2]=abs(dot(p,normalize(vec3(1,-1,1))));
        ds[3]=abs(dot(p,normalize(vec3(-1,1,1))));
        ds[4]=abs(dot(p,normalize(vec3(0,IP,PHI))));
        ds[5]=abs(dot(p,normalize(vec3(0,IP,-PHI))));
        ds[6]=abs(dot(p,normalize(vec3(IP,PHI,0))));
        ds[7]=abs(dot(p,normalize(vec3(IP,-PHI,0))));
        ds[8]=abs(dot(p,normalize(vec3(PHI,0,IP))));
        ds[9]=abs(dot(p,normalize(vec3(PHI,0,-IP))));
        float m1=0.0, m2=0.0;
        for(int i=0;i<10;i++){
          if(ds[i]>m1){m2=m1;m1=ds[i];}
          else if(ds[i]>m2){m2=ds[i];}
        }
        return (m1-m2) < 0.004 ? 1.0 : 0.0;
      }
    `,
```

- [ ] **Step 2: Thin edge detection for octahedron and dodecahedron**

In `SDF_FUNCTIONS.octahedron` (~line 1598), replace:
```
return smoothstep(glowWidth * 3.0, 0.0, abs(m1 - m2)) > 0.5 ? 1.0 : 0.0;
```
with:
```
return (m1 - m2) < 0.004 ? 1.0 : 0.0;
```

In `SDF_FUNCTIONS.dodecahedron` (~line 1697), replace:
```
return smoothstep(glowWidth * 3.0, 0.0, abs(m1 - m2)) > 0.5 ? 1.0 : 0.0;
```
with:
```
return (m1 - m2) < 0.004 ? 1.0 : 0.0;
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: true icosahedron SDF (10 normals) + thin edges for all shapes"
```

---

### Task 3: Inject lattice grid into buildFragmentShader and enable grids

**Files:**
- Modify: `index.html` — `buildFragmentShader()` (~line 2005), `SHAPE_META` (~line 1996)

- [ ] **Step 1: Enable grids for all shapes in SHAPE_META**

Replace SHAPE_META (lines 1996-2003):
```javascript
  const SHAPE_META = {
    cube: { hasGrid: true },
    octahedron: { hasGrid: true },
    icosahedron: { hasGrid: true },
    dodecahedron: { hasGrid: true },
    stellated: { hasGrid: true },
    compound: { hasGrid: true },
  };
```

- [ ] **Step 2: Update buildFragmentShader to inject lattice grid**

Replace the `buildFragmentShader` function with:

```javascript
  function buildFragmentShader(shapeName) {
    const sdfCode = SDF_FUNCTIONS[shapeName] || SDF_FUNCTIONS.cube;
    const gridConfig = SHAPE_GRID_CONFIG[shapeName];
    // Generate lattice grid code if config exists, otherwise use cube grid
    const gridCode = gridConfig ? buildLatticeGrid(gridConfig) : '';
    const gridFuncName = gridConfig ? 'latticeGrid' : 'infiniteGrid';
    const needsCubeGrid = !gridConfig;

    return `
      precision highp float;

      varying vec3 vPos;

      uniform vec3 cam;
      uniform float eta;
      uniform float glow;
      uniform float glowWidth;
      uniform vec3 lightColor;
      uniform float complexity;
      uniform float envIntensity;
      uniform mat4 lightMatrix;
      uniform mat4 modelMatrix;
      uniform float seconds;
      uniform float fresnelPower;
      uniform float gridScale;
      uniform float gridEnabled;

      #define SIZE vec3(0.45)
      #define RAD 0.05
      #define STEPS 16.0
      #define cellScale 1.0

      ${sdfCode}

      ${needsCubeGrid ? `
      vec3 infiniteGrid(vec3 ro, vec3 rd) {
        vec3 ird = 1.0 / rd;
        float bestV = 20.0;
        float bestP = 0.0;
        for (int axis = 0; axis < 3; axis++) {
          vec3 ro2 = axis == 0 ? ro.zyx : (axis == 1 ? ro.xzy : ro);
          vec3 rd2 = axis == 0 ? rd.zyx : (axis == 1 ? rd.xzy : rd);
          vec3 ird2 = axis == 0 ? ird.zyx : (axis == 1 ? ird.xzy : ird);
          float sz = rd2.z < 0.0 ? -1.0 : 1.0;
          float d = (glowWidth - 0.5 - ro2.z * sz) * ird2.z * sz;
          if (d < 0.0) {
            vec2 xy = ro2.xy + rd2.xy * d + 0.5;
            for (float i = 0.0; i < STEPS; i++) {
              vec2 uv = fract(xy);
              float osg = 1.0 - glowWidth;
              if (uv.x <= glowWidth || uv.x >= osg || uv.y <= glowWidth || uv.y >= osg) {
                vec2 xyi = abs(floor(xy));
                float v = max(xyi.x, xyi.y) + i;
                vec2 frame = abs(uv - 0.5) - 0.5 + glowWidth;
                float sdf2 = length(max(frame, 0.0)) + min(max(frame.x, frame.y), 0.0);
                sdf2 = sdf2 / glowWidth; sdf2 *= sdf2;
                vec2 f = 1.0 - 2.0 * abs(uv - 0.5);
                float p = 3.0 - 2.0 * max(f.x, f.y);
                p = pow(p, 4.0); p *= sdf2 * sdf2; p = max(p, 0.0);
                p = mix(1.0, p, complexity);
                if (v < bestV) { bestV = v; bestP = p; }
                break;
              }
              xy -= rd2.xy * ird2.z * sz;
            }
          }
        }
        return vec3(bestV, 0.0, bestP);
      }` : gridCode}

      float fresnel(vec3 rd, vec3 n) {
        float cosI = abs(dot(rd, n));
        return pow(1.0 - cosI, fresnelPower);
      }

      vec3 getEnv(vec3 ro, vec3 rd) {
        vec3 ori = (lightMatrix * modelMatrix * vec4(ro, 1.0)).xyz;
        vec3 dir = (lightMatrix * modelMatrix * vec4(rd, 0.0)).xyz;
        vec3 color = vec3(0.0);
        float d = -ori.z / dir.z;
        if (d > 0.0) {
          vec2 p = ori.xy + dir.xy * d;
          p = 1.0 - p * p;
          float l = step(0.0, p.x) * step(0.0, p.y);
          l *= 1.0 - 0.8 * p.x * p.y;
          color += l * envIntensity;
        }
        float y = rd.y * 0.5 + 0.5;
        color += mix(vec3(0.01), vec3(0.05, 0.04, 0.03), y);
        return color;
      }

      void main() {
        vec3 rd = normalize(vPos - cam);

        float d = shapeIntersect(cam, rd);
        if (d < 0.0) { discard; return; }

        vec3 hitPos = cam + rd * d;
        vec3 nor = shapeNormal(hitPos);

        vec3 color = getEnv(hitPos, reflect(rd, nor)) * fresnel(rd, nor);

        float cosI = dot(rd, nor);
        float k = cosI * cosI + eta * eta - 1.0;
        if (k >= 0.0) {
          vec3 refDir = normalize(nor * (sqrt(k) + cosI) - rd);
          float power = 1.0 - fresnel(refDir, -nor);

          if (gridEnabled > 0.5) {
            float edge = shapeEdge(hitPos);
            if (edge > 0.5) {
              color += lightColor * power;
            } else {
              vec3 f = ${gridFuncName}(hitPos, refDir);
              color += pow(glow, f.x) * f.z * power * lightColor;
            }
          } else {
            color += getEnv(hitPos, refDir) * power * lightColor;
          }
        }

        color = max(vec3(0.0), color + (fract(sin(dot(vPos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }
```

- [ ] **Step 3: Add cellScale uniform to cubeMat**

In the cubeMat uniforms (~line 2132), add after `gridEnabled`:
```javascript
    cellScale: { value: 1.0 },
```

- [ ] **Step 4: Visual verification**

Open `http://localhost:8765/index.html`, use constructor panel to switch shapes. Each shape should show:
- Glowing grid lines with depth (not just glass)
- Cube: original square grid (unchanged)
- Octahedron: triangular grid (4 axes, linesPerAxis=3)
- Icosahedron: triangular grid, different shape than dodecahedron
- Dodecahedron: 6-axis pattern

Take headless Chrome screenshots for verification.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: enable lattice grids for all shapes on main page"
```

---

### Task 4: Ensure setShape always enables grid

**Files:**
- Modify: `index.html` — `setShape()` (~line 2647)

- [ ] **Step 1: Remove grid auto-disable logic**

In `setShapeImpl` (~line 2657-2666), the current code auto-disables grid for non-cube shapes. Since SHAPE_META now has `hasGrid: true` for all, this should work automatically. Verify by switching shapes — grid should stay on.

If grid still turns off, check that the SHAPE_META changes from Task 3 Step 1 are applied correctly.

- [ ] **Step 2: Final visual check + commit**

Switch through all shapes, verify grid is visible on each. Compare with test-shapes.html at same angles.

```bash
git add index.html
git commit -m "polish: verify grid enabled for all shapes on main page"
```
