/**
 * hypercube — SDF raymarched Platonic solids with fluid distortion,
 *             aurora ribbons and GPGPU particles.
 *
 * (c) 2026 outhead  —  MIT License  —  https://github.com/outhead/hypercube
 *
 * Single-file Three.js scene: 6 SDF solids rendered as a single
 * raymarched fragment, lit by a fake area light, refracted through a
 * thickness volume, and distorted by a Jos-Stam fluid sim on top.
 */
import * as THREE from 'three';
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
  import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

  /* =========================================================
     CONFIG FALLBACK — shares window.config if host page has one,
     otherwise uses defaults copied from index.html.
  ========================================================= */
  const __DEFAULT_CONFIG__ = {
    object: { shape:'icosahedron', eta:1.07, glow:0.34, complexity:0.66, gridScale:1.0, gridEnabled:true, lightColor:'#7b5623', scale:3.9, shapeSize:0.55, shapeRound:0.015, iridMode:1, iridStrength:0.29, iridHue:0.405 },
    bloom: { strength:0.34, radius:0.5, threshold:0.15, exposure:1.26 },
    particles: { count:4096, focus:0.9, focusDistance:3.0, grid:false, sine:false },
    aurora: { enabled:true, mode:'rainbow', color:'#5ad2c6', intensity:0.013, height:-1.0, scale:4.5, hueShift:0.20, hueSpread:1.50, hueSat:0.72 },
    camera: { fov:45, distance:8, parallaxStrength:1.0, orbit:false, orbitSpeed:0.5, speedVariation:0.5 },
    presentation: { shapeInterval:8, speed:1.0 }
  };
  if (typeof window !== 'undefined' && !window.config) window.config = __DEFAULT_CONFIG__;
  const config = (typeof window !== 'undefined' && window.config) ? window.config : __DEFAULT_CONFIG__;

  // === Scene configuration ===
  const BRAND_COLOR = '#d49c4d';

  const canvas = document.getElementById('webgl');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera: FOV=45
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(0, 0.5, 8);
  camera.lookAt(0, 0, 0);

  // Renderer configuration
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.65;

  // Post-processing: bloom
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Bloom configuration
  // Slightly increased strength to compensate for missing 5-level custom bloom
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3,   // strength
    0.5,   // radius (wider for soft atmospheric glow)
    0.15   // threshold
  );
  composer.addPass(bloomPass);

  // === Fluid Simulation (cursor-driven distortion) ===
  const SIM_RES = 128;
  const fluidTexelSize = new THREE.Vector2(1.0 / SIM_RES, 1.0 / SIM_RES);

  const fluidRTOpts = {
    type: THREE.FloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  };
  let fluidDensityA = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, fluidRTOpts);
  let fluidDensityB = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, fluidRTOpts);

  const fluidQuadGeo = new THREE.PlaneGeometry(2, 2);
  const fluidScene = new THREE.Scene();
  const fluidCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const splatMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTarget: { value: null },
      point: { value: new THREE.Vector2(0.5, 0.5) },
      color: { value: new THREE.Vector3(0, 0, 0) },
      radius: { value: 0.002 },
      texelSize: { value: fluidTexelSize },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform vec2 point;
      uniform vec3 color;
      uniform float radius;
      void main() {
        vec4 base = texture2D(uTarget, vUv);
        vec2 d = vUv - point;
        float splat = exp(-dot(d, d) / radius);
        base.xyz += color * splat;
        gl_FragColor = base;
      }
    `,
  });

  const advectMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uVelocity: { value: null },
      uSource: { value: null },
      texelSize: { value: fluidTexelSize },
      dt: { value: 0.016 },
      dissipation: { value: 0.985 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      void main() {
        vec2 vel = texture2D(uVelocity, vUv).xy;
        vec2 coord = vUv - vel * dt * texelSize * 5.0;
        gl_FragColor = texture2D(uSource, coord) * dissipation;
      }
    `,
  });

  const fluidQuad = new THREE.Mesh(fluidQuadGeo, splatMaterial);
  fluidScene.add(fluidQuad);

  // fluidActive: stays true for ~5 s after last mouse move so dissipation finishes,
  // then advection is skipped entirely to save a GPU blit per frame.
  const fluidMouse = { x: 0.5, y: 0.5, prevX: 0.5, prevY: 0.5, dx: 0, dy: 0, moved: false, lastMoveTime: -9999 };
  // Mouse input for fluid splat removed — fluidMouse retained so updateFluidSim
  // still compiles; its advection branch is skipped because lastMoveTime stays at -9999.

  function fluidBlit(mat, target) {
    fluidQuad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(fluidScene, fluidCamera);
    renderer.setRenderTarget(null);
  }

  function updateFluidSim() {
    const currentRT = renderer.getRenderTarget();
    const currentAutoClear = renderer.autoClear;
    renderer.autoClear = true;

    if (fluidMouse.moved) {
      fluidMouse.moved = false;
      const speed = Math.sqrt(fluidMouse.dx * fluidMouse.dx + fluidMouse.dy * fluidMouse.dy);
      if (speed > 0.0001) {
        const splatForce = 5000; // mouse effects removed; branch unreachable
        splatMaterial.uniforms.uTarget.value = fluidDensityA.texture;
        splatMaterial.uniforms.point.value.set(fluidMouse.x, fluidMouse.y);
        splatMaterial.uniforms.color.value.set(
          fluidMouse.dx * splatForce,
          fluidMouse.dy * splatForce,
          speed * splatForce
        );
        splatMaterial.uniforms.radius.value = 0.004;
        fluidBlit(splatMaterial, fluidDensityB);
        [fluidDensityA, fluidDensityB] = [fluidDensityB, fluidDensityA];
      }
    }

    // Skip advection when fluid has fully dissipated (no mouse move for > 5 s).
    // At dissipation=0.985 the fluid retains ~0.04% of its initial energy after 450 frames (~7.5 s),
    // so 5 s is a safe cut-off that saves one GPU blit per frame at idle.
    const fluidAge = performance.now() - fluidMouse.lastMoveTime;
    if (fluidAge < 5000) {
      advectMaterial.uniforms.uVelocity.value = fluidDensityA.texture;
      advectMaterial.uniforms.uSource.value = fluidDensityA.texture;
      advectMaterial.uniforms.dissipation.value = 0.985;
      fluidBlit(advectMaterial, fluidDensityB);
      [fluidDensityA, fluidDensityB] = [fluidDensityB, fluidDensityA];
    }

    renderer.autoClear = currentAutoClear;
    renderer.setRenderTarget(currentRT);
  }

  // Distortion ShaderPass — chromatic + barrel refraction through iridescence LUT
  const fluidDistortionShader = {
    uniforms: {
      tDiffuse: { value: null },
      fluidMap: { value: fluidDensityA.texture },
      pixelSize: { value: new THREE.Vector2(1.0 / window.innerWidth, 1.0 / window.innerHeight) },
      uDistortScale: { value: 1.0 },
      uDiffractScale: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform sampler2D fluidMap;
      uniform vec2 pixelSize;
      uniform float uDistortScale;
      uniform float uDiffractScale;

      void main() {
        vec2 uv = vUv;
        vec2 duv = texture2D(fluidMap, uv).xy * 5e-4 * uDistortScale;
        vec2 fc = uv - 0.5;
        vec2 barrel2 = uv * (1.0 - uv);
        float barrel = pow(1.0 - 16.0 * barrel2.x * barrel2.y, 3.0);
        float power = smoothstep(0.005, 0.015, length(duv));
        uv += duv;
        vec3 color = texture2D(tDiffuse, uv).rgb;
        if (power > 0.) {
          vec2 dir = normalize(duv) * pixelSize * 3.0 * uDiffractScale;
          uv = vUv + duv;
          uv -= dir * 4.;
          vec3 weight = vec3(1.);
          for (float i = 0.; i < 8.; i++) {
            uv += dir;
            vec3 hue = vec3(
              abs(fract(i/8. * 6. - 3.) - 1.) - 1.,
              2. - abs(fract(i/8. * 6. - 2.) - 2.),
              2. - abs(fract(i/8. * 6. - 4.) - 2.)
            );
            hue = clamp(hue, 0., 1.) * 0.9 + 0.1;
            hue *= power;
            color += texture2D(tDiffuse, uv).rgb * hue;
            weight += hue;
          }
          color /= weight;
        }
        gl_FragColor = vec4(color, 1.);
      }
    `,
  };

  const fluidPass = new ShaderPass(fluidDistortionShader);
  composer.addPass(fluidPass);
  fluidPass.enabled = false; // mouse-driven distortion removed
  composer.addPass(new OutputPass());

  window.scene3d = { scene, camera, renderer, composer, fluidPass };

  // Environment map (PMREM)
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const textureLoader = new THREE.TextureLoader();
  let envMap = null;
  // Iridescence LUT (1D rainbow gradient) for cube shader mode 2
  const iridLUT = textureLoader.load('https://cdn.jsdelivr.net/gh/outhead/hypercube@main/assets/iridescence.png');
  iridLUT.wrapS = THREE.RepeatWrapping;
  iridLUT.wrapT = THREE.ClampToEdgeWrapping;
  iridLUT.minFilter = THREE.LinearFilter;
  iridLUT.magFilter = THREE.LinearFilter;
  textureLoader.load('https://cdn.jsdelivr.net/gh/outhead/hypercube@main/assets/env.jpg', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmremGenerator.dispose();
  });

  // === SDF Shape Library ===
  const SDF_FUNCTIONS = {
    cube: `
      float shapeSDF(vec3 p) {
        vec3 d = abs(p) - SIZE + RAD;
        return length(max(d, 0.0)) - RAD + min(max(d.x, max(d.y, d.z)), 0.0);
      }
      vec3 shapeNormal(vec3 p) {
        return sign(p) * normalize(max(abs(p) - SIZE, 0.0));
      }
      float shapeIntersect(vec3 ro, vec3 rd) {
        vec3 m = 1.0 / rd;
        vec3 n = m * ro;
        vec3 k = abs(m) * (SIZE + RAD);
        vec3 t1 = -n - k;
        vec3 t2 = -n + k;
        float tN = max(max(t1.x, t1.y), t1.z);
        float tF = min(min(t2.x, t2.y), t2.z);
        if (tN > tF || tF < 0.0) return -1.0;
        return tN;
      }
      float shapeEdge(vec3 p) {
        vec3 pc = p + 0.5;
        int ec = 0;
        if (pc.x <= glowWidth || pc.x >= 1.0 - glowWidth) ec++;
        if (pc.y <= glowWidth || pc.y >= 1.0 - glowWidth) ec++;
        if (pc.z <= glowWidth || pc.z >= 1.0 - glowWidth) ec++;
        return ec >= 2 ? 1.0 : 0.0;
      }
    `,
    octahedron: `
      float smax2(float a, float b, float k) {
        if (k <= 0.0) return max(a, b);
        float h = clamp(0.5 + 0.5*(a - b)/k, 0.0, 1.0);
        return mix(b, a, h) + k*h*(1.0 - h);
      }
      float shapeSDF(vec3 p) {
        float d0 = dot(p, normalize(vec3( 1, 1, 1)));
        float d1 = dot(p, normalize(vec3( 1, 1,-1)));
        float d2 = dot(p, normalize(vec3( 1,-1, 1)));
        float d3 = dot(p, normalize(vec3(-1, 1, 1)));
        float k = shapeRound;
        float d = smax2(abs(d0), abs(d1), k);
        d = smax2(d, abs(d2), k);
        d = smax2(d, abs(d3), k);
        return d - shapeSize;
      }
      vec3 shapeNormal(vec3 p) {
        vec2 e = vec2(0.0005, 0.0);
        return normalize(vec3(
          shapeSDF(p+e.xyy)-shapeSDF(p-e.xyy),
          shapeSDF(p+e.yxy)-shapeSDF(p-e.yxy),
          shapeSDF(p+e.yyx)-shapeSDF(p-e.yyx)));
      }
      float shapeIntersect(vec3 ro, vec3 rd) {
        float t = 0.0;
        float d0 = shapeSDF(ro);
        if (d0 < 0.0) { t = -d0 + 0.01; } // start outside if camera is inside
        for(int i=0; i<80; i++) {
          float d = shapeSDF(ro + rd*t);
          if(d < 0.001) return t;
          if(t > 5.0) break;
          t += d * 0.7;
        }
        return -1.0;
      }
      float shapeEdge(vec3 p) {
        float d[4];
        d[0] = abs(dot(p, normalize(vec3(1,1,1))));
        d[1] = abs(dot(p, normalize(vec3(1,1,-1))));
        d[2] = abs(dot(p, normalize(vec3(1,-1,1))));
        d[3] = abs(dot(p, normalize(vec3(-1,1,1))));
        // find two largest
        float m1 = 0.0, m2 = 0.0;
        for (int i = 0; i < 4; i++) {
          if (d[i] > m1) { m2 = m1; m1 = d[i]; }
          else if (d[i] > m2) { m2 = d[i]; }
        }
        return (m1 - m2) < 0.004 ? 1.0 : 0.0;
      }
    `,
    icosahedron: `
      #define PHI 1.618033988749895
      #define IP 0.618033988749895
      float smax2(float a, float b, float k) {
        if (k <= 0.0) return max(a, b);
        float h = clamp(0.5 + 0.5*(a - b)/k, 0.0, 1.0);
        return mix(b, a, h) + k*h*(1.0 - h);
      }
      float icoSDF(vec3 p) {
        float k = shapeRound;
        float d = abs(dot(p, normalize(vec3(1,1,1))));
        d = smax2(d, abs(dot(p, normalize(vec3(1,1,-1)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(1,-1,1)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(-1,1,1)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(0,IP,PHI)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(0,IP,-PHI)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(IP,PHI,0)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(IP,-PHI,0)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(PHI,0,IP)))), k);
        d = smax2(d, abs(dot(p, normalize(vec3(PHI,0,-IP)))), k);
        return d - shapeSize;
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
        float d0 = shapeSDF(ro);
        if (d0 < 0.0) { t = -d0 + 0.01; } // start outside if camera is inside
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
    dodecahedron: `
      #define PHI 1.618033988749895
      float smax2(float a, float b, float k) {
        if (k <= 0.0) return max(a, b);
        float h = clamp(0.5 + 0.5*(a - b)/k, 0.0, 1.0);
        return mix(b, a, h) + k*h*(1.0 - h);
      }
      float dodSDF(vec3 p) {
        vec3 n1 = normalize(vec3(0.0, 1.0, PHI));
        vec3 n2 = normalize(vec3(0.0, -1.0, PHI));
        vec3 n3 = normalize(vec3(PHI, 0.0, 1.0));
        vec3 n4 = normalize(vec3(-PHI, 0.0, 1.0));
        vec3 n5 = normalize(vec3(1.0, PHI, 0.0));
        vec3 n6 = normalize(vec3(-1.0, PHI, 0.0));
        float k = shapeRound;
        float d = smax2(abs(dot(p,n1)), abs(dot(p,n2)), k);
        d = smax2(d, abs(dot(p,n3)), k);
        d = smax2(d, abs(dot(p,n4)), k);
        d = smax2(d, abs(dot(p,n5)), k);
        d = smax2(d, abs(dot(p,n6)), k);
        return d - shapeSize;
      }
      float shapeSDF(vec3 p) { return dodSDF(p); }
      vec3 shapeNormal(vec3 p) {
        vec2 e = vec2(0.0005, 0.0);
        return normalize(vec3(
          shapeSDF(p+e.xyy)-shapeSDF(p-e.xyy),
          shapeSDF(p+e.yxy)-shapeSDF(p-e.yxy),
          shapeSDF(p+e.yyx)-shapeSDF(p-e.yyx)));
      }
      float shapeIntersect(vec3 ro, vec3 rd) {
        float t = 0.0;
        float d0 = shapeSDF(ro);
        if (d0 < 0.0) { t = -d0 + 0.01; } // start outside if camera is inside
        for(int i=0; i<80; i++) {
          float d = shapeSDF(ro + rd*t);
          if(d < 0.001) return t;
          if(t > 5.0) break;
          t += d * 0.7;
        }
        return -1.0;
      }
      float shapeEdge(vec3 p) {
        vec3 n1 = normalize(vec3(0.0, 1.0, PHI));
        vec3 n2 = normalize(vec3(0.0, -1.0, PHI));
        vec3 n3 = normalize(vec3(PHI, 0.0, 1.0));
        vec3 n4 = normalize(vec3(-PHI, 0.0, 1.0));
        vec3 n5 = normalize(vec3(1.0, PHI, 0.0));
        vec3 n6 = normalize(vec3(-1.0, PHI, 0.0));
        float d[6];
        d[0] = abs(dot(p,n1)); d[1] = abs(dot(p,n2)); d[2] = abs(dot(p,n3));
        d[3] = abs(dot(p,n4)); d[4] = abs(dot(p,n5)); d[5] = abs(dot(p,n6));
        float m1 = 0.0, m2 = 0.0;
        for (int i = 0; i < 6; i++) {
          if (d[i] > m1) { m2 = m1; m1 = d[i]; }
          else if (d[i] > m2) { m2 = d[i]; }
        }
        return (m1 - m2) < 0.004 ? 1.0 : 0.0;
      }
    `,
    stellated: `
      #define PHI 1.618033988749895
      float icoSDF_s(vec3 p) {
        vec3 n1 = normalize(vec3(1.0, PHI, 0.0));
        vec3 n2 = normalize(vec3(-1.0, PHI, 0.0));
        vec3 n3 = normalize(vec3(0.0, 1.0, PHI));
        vec3 n4 = normalize(vec3(0.0, 1.0, -PHI));
        vec3 n5 = normalize(vec3(PHI, 0.0, 1.0));
        vec3 n6 = normalize(vec3(-PHI, 0.0, 1.0));
        float d = max(max(max(abs(dot(p,n1)), abs(dot(p,n2))), max(abs(dot(p,n3)), abs(dot(p,n4)))), max(abs(dot(p,n5)), abs(dot(p,n6))));
        return d - 0.45;
      }
      float dodSDF_s(vec3 p) {
        vec3 n1 = normalize(vec3(0.0, 1.0, PHI));
        vec3 n2 = normalize(vec3(0.0, -1.0, PHI));
        vec3 n3 = normalize(vec3(PHI, 0.0, 1.0));
        vec3 n4 = normalize(vec3(-PHI, 0.0, 1.0));
        vec3 n5 = normalize(vec3(1.0, PHI, 0.0));
        vec3 n6 = normalize(vec3(-1.0, PHI, 0.0));
        float d = max(max(max(abs(dot(p,n1)), abs(dot(p,n2))), max(abs(dot(p,n3)), abs(dot(p,n4)))),
                      max(abs(dot(p,n5)), abs(dot(p,n6))));
        return d - 0.32;
      }
      float shapeSDF(vec3 p) { return max(icoSDF_s(p), -dodSDF_s(p)); }
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
          t += d * 0.5;
        }
        return -1.0;
      }
      float shapeEdge(vec3 p) {
        // Stellated = icosahedron minus dodecahedron; detect edges from both
        vec3 in1 = normalize(vec3(1.0, PHI, 0.0));
        vec3 in2 = normalize(vec3(-1.0, PHI, 0.0));
        vec3 in3 = normalize(vec3(0.0, 1.0, PHI));
        vec3 in4 = normalize(vec3(0.0, 1.0, -PHI));
        vec3 in5 = normalize(vec3(PHI, 0.0, 1.0));
        vec3 in6 = normalize(vec3(-PHI, 0.0, 1.0));
        vec3 dn1 = normalize(vec3(0.0, 1.0, PHI));
        vec3 dn2 = normalize(vec3(0.0, -1.0, PHI));
        vec3 dn3 = normalize(vec3(PHI, 0.0, 1.0));
        vec3 dn4 = normalize(vec3(-PHI, 0.0, 1.0));
        vec3 dn5 = normalize(vec3(1.0, PHI, 0.0));
        vec3 dn6 = normalize(vec3(-1.0, PHI, 0.0));
        // Use gradient-based edge detection via SDF
        vec2 e = vec2(0.002, 0.0);
        float gx = shapeSDF(p+e.xyy)-shapeSDF(p-e.xyy);
        float gy = shapeSDF(p+e.yxy)-shapeSDF(p-e.yxy);
        float gz = shapeSDF(p+e.yyx)-shapeSDF(p-e.yyx);
        vec3 n = normalize(vec3(gx,gy,gz));
        // Check if near intersection of icosahedron and dodecahedron surfaces
        float icoD = icoSDF_s(p) + 0.45;
        float dodD = dodSDF_s(p) + 0.32;
        float diff = abs(icoD - dodD);
        if (diff < glowWidth * 6.0) return 1.0;
        // Also check icosahedron face edges
        float d[6];
        d[0] = abs(dot(p,in1)); d[1] = abs(dot(p,in2)); d[2] = abs(dot(p,in3));
        d[3] = abs(dot(p,in4)); d[4] = abs(dot(p,in5)); d[5] = abs(dot(p,in6));
        float m1 = 0.0, m2 = 0.0;
        for (int i = 0; i < 6; i++) {
          if (d[i] > m1) { m2 = m1; m1 = d[i]; }
          else if (d[i] > m2) { m2 = d[i]; }
        }
        return smoothstep(glowWidth * 3.0, 0.0, abs(m1 - m2)) > 0.5 ? 1.0 : 0.0;
      }
    `,
    compound: `
      mat3 rotY45() {
        float c = 0.7071067811865476; float s = 0.7071067811865476;
        return mat3(c,0,s, 0,1,0, -s,0,c);
      }
      mat3 rotX45() {
        float c = 0.7071067811865476; float s = 0.7071067811865476;
        return mat3(1,0,0, 0,c,-s, 0,s,c);
      }
      float boxSDF(vec3 p, vec3 b) {
        vec3 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
      }
      float shapeSDF(vec3 p) {
        float d1 = boxSDF(p, vec3(0.42, 0.18, 0.18));
        float d2 = boxSDF(rotY45() * p, vec3(0.42, 0.18, 0.18));
        float d3 = boxSDF(rotX45() * p, vec3(0.18, 0.42, 0.18));
        float d4 = boxSDF(rotX45() * rotY45() * p, vec3(0.18, 0.18, 0.42));
        return min(min(d1, d2), min(d3, d4));
      }
      vec3 shapeNormal(vec3 p) {
        vec2 e = vec2(0.0005, 0.0);
        return normalize(vec3(
          shapeSDF(p+e.xyy)-shapeSDF(p-e.xyy),
          shapeSDF(p+e.yxy)-shapeSDF(p-e.yxy),
          shapeSDF(p+e.yyx)-shapeSDF(p-e.yyx)));
      }
      float shapeIntersect(vec3 ro, vec3 rd) {
        float t = 0.0;
        float d0 = shapeSDF(ro);
        if (d0 < 0.0) { t = -d0 + 0.01; } // start outside if camera is inside
        for(int i=0; i<80; i++) {
          float d = shapeSDF(ro + rd*t);
          if(d < 0.001) return t;
          if(t > 5.0) break;
          t += d * 0.7;
        }
        return -1.0;
      }
      float shapeEdge(vec3 p) {
        // For compound boxes, edge where two different boxes meet OR where box edges are
        float d1 = boxSDF(p, vec3(0.42, 0.18, 0.18));
        float d2 = boxSDF(rotY45() * p, vec3(0.42, 0.18, 0.18));
        float d3 = boxSDF(rotX45() * p, vec3(0.18, 0.42, 0.18));
        float d4 = boxSDF(rotX45() * rotY45() * p, vec3(0.18, 0.18, 0.42));
        float mn = min(min(d1, d2), min(d3, d4));
        // Check if two boxes meet (intersection edge)
        float m1 = 10.0, m2 = 10.0;
        float ds[4];
        ds[0] = d1; ds[1] = d2; ds[2] = d3; ds[3] = d4;
        for (int i = 0; i < 4; i++) {
          if (ds[i] < m1) { m2 = m1; m1 = ds[i]; }
          else if (ds[i] < m2) { m2 = ds[i]; }
        }
        if (abs(m1 - m2) < glowWidth * 6.0) return 1.0;
        // Also check individual box edges for the closest box
        // Use face-plane approach for a box: 3 axis pairs
        vec3 bp = p;
        vec3 bs = vec3(0.42, 0.18, 0.18);
        if (mn == d2) { bp = rotY45() * p; }
        else if (mn == d3) { bp = rotX45() * p; bs = vec3(0.18, 0.42, 0.18); }
        else if (mn == d4) { bp = rotX45() * rotY45() * p; bs = vec3(0.18, 0.18, 0.42); }
        vec3 ad = abs(bp);
        vec3 dist = bs - ad;
        int ec = 0;
        if (dist.x < glowWidth * 2.0) ec++;
        if (dist.y < glowWidth * 2.0) ec++;
        if (dist.z < glowWidth * 2.0) ec++;
        return ec >= 2 ? 1.0 : 0.0;
      }
    `,
  };

  // SDF raymarching fragment shader — refraction + fresnel-lit glass with internal lattice
  const GLASS_FRAG = `
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
      uniform float shapeSize;
      uniform float shapeRound;
      uniform float edgeGlow;
      uniform float uIridMode;
      uniform float uIridStrength;
      uniform float uIridHue;
      uniform sampler2D iridLUT;

      #define SIZE vec3(shapeSize)
      #define RAD shapeRound
      #define STEPS 16.0

      float roundedBoxIntersect(vec3 ro, vec3 rd, vec3 size, float rad) {
        vec3 m = 1.0 / rd;
        vec3 n = m * ro;
        vec3 k = abs(m) * (size + rad);
        vec3 t1 = -n - k;
        vec3 t2 = -n + k;
        float tN = max(max(t1.x, t1.y), t1.z);
        float tF = min(min(t2.x, t2.y), t2.z);
        if (tN > tF || tF < 0.0) return -1.0;
        return tN > 0.0 ? tN : tF;
      }

      vec3 roundedBoxNormal(vec3 p, vec3 size) {
        return sign(p) * normalize(max(abs(p) - size + RAD, 0.0));
      }

      float fresnel(vec3 rd, vec3 n) {
        float cosI = abs(dot(rd, n));
        return pow(1.0 - cosI, 3.0);
      }

      vec3 iridescence(float t) {
        if (uIridMode < 0.5) return vec3(1.0);
        if (uIridMode < 1.5) {
          // Cosine palette (Inigo Quilez) — RGB phases 0 / 1/3 / 2/3
          return 0.5 + 0.5 * cos(6.28318 * (uIridHue + t + vec3(0.0, 0.333, 0.667)));
        }
        if (uIridMode < 2.5) {
          // LUT sample — 1D gradient from iridescence.png
          return texture2D(iridLUT, vec2(fract(t + uIridHue), 0.5)).rgb;
        }
        // Thin-film dispersion — wavelength-weighted phase (R/G/B = 650/550/440 nm)
        vec3 lambda = vec3(1.0, 0.87, 0.68);
        return 0.5 + 0.5 * cos(6.28318 * (t / lambda + uIridHue));
      }

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
              float oneSubGlow = 1.0 - glowWidth;

              if (uv.x <= glowWidth || uv.x >= oneSubGlow ||
                  uv.y <= glowWidth || uv.y >= oneSubGlow) {
                vec2 xyi = abs(floor(xy));
                float v = max(xyi.x, xyi.y) + i;

                vec2 frame = abs(uv - 0.5) - 0.5 + glowWidth;
                float sdf = length(max(frame, 0.0)) + min(max(frame.x, frame.y), 0.0);
                sdf = sdf / glowWidth;
                sdf *= sdf;

                vec2 f = 1.0 - 2.0 * abs(uv - 0.5);
                float p = 3.0 - 2.0 * max(f.x, f.y);
                p = pow(p, 4.0);
                p *= sdf * sdf;
                p = max(p, 0.0);
                p = mix(1.0, p, complexity);

                if (v < bestV) {
                  bestV = v;
                  bestP = p;
                }
                break;
              }
              xy -= rd2.xy * ird2.z * sz;
            }
          }
        }

        return vec3(bestV, 0.0, bestP);
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

        float d = roundedBoxIntersect(cam, rd, SIZE, RAD);
        if (d < 0.0) { discard; return; }

        vec3 hitPos = cam + rd * d;
        vec3 nor = roundedBoxNormal(hitPos, SIZE);

        float fr = fresnel(rd, nor);
        vec3 iridTint = mix(vec3(1.0), iridescence(fr) * 1.8, uIridStrength);
        vec3 color = getEnv(hitPos, reflect(rd, nor)) * fr * iridTint;

        float cosI = dot(rd, nor);
        float k = cosI * cosI + eta * eta - 1.0;
        if (k >= 0.0) {
          vec3 refDir = normalize(nor * (sqrt(k) + cosI) - rd);
          float power = 1.0 - fresnel(refDir, -nor);

          vec3 pc = hitPos + 0.5;
          int edgeCount = 0;
          if (pc.x <= glowWidth || pc.x >= 1.0 - glowWidth) edgeCount++;
          if (pc.y <= glowWidth || pc.y >= 1.0 - glowWidth) edgeCount++;
          if (pc.z <= glowWidth || pc.z >= 1.0 - glowWidth) edgeCount++;

          if (edgeCount >= 2 && edgeGlow > 0.01) {
            color += lightColor * iridTint * power * edgeGlow;
          } else {
            vec3 f = infiniteGrid(hitPos, refDir);
            color += pow(glow, f.x) * f.z * power * lightColor * iridTint;
          }
        }

        color = max(vec3(0.0), color + (fract(sin(dot(vPos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0);

        gl_FragColor = vec4(color, 1.0);
      }
  `;

  const SHAPE_META = {
    cube:         { hasGrid: true, defaultSize: 0.49, defaultRound: 0.02, glow: 0.57, glowWidth: 0.008, complexity: 1.0, fresnelPower: 3.0, envIntensity: 5.0, eta: 1.75, scale: 3, bloom: { exposure: 0.65, strength: 0.3 }, zoomNormal: [0,0,1] },
    octahedron:   { hasGrid: true, defaultSize: 0.10, defaultRound: 0.011, glow: 0.57, glowWidth: 0.008, complexity: 1.0, fresnelPower: 3.5, envIntensity: 13.4, eta: 1.01, scale: 16.0, bloom: { exposure: 1.06, strength: 0.33 }, zoomNormal: [0.577,0.577,0.577] },
    icosahedron:  { hasGrid: true, defaultSize: 0.55, defaultRound: 0.015, glow: 0.52, glowWidth: 0.006, complexity: 1.0, fresnelPower: 4.1, envIntensity: 14.1, eta: 1.07, scale: 3.9, bloom: { exposure: 0.65, strength: 0.3 }, zoomNormal: [0,0.526,0.851] },
    dodecahedron: { hasGrid: true, defaultSize: 0.55, defaultRound: 0.023, glow: 0.50, glowWidth: 0.009, complexity: 1.0, fresnelPower: 3.5, envIntensity: 13.4, eta: 0.98, scale: 3.9, bloom: { exposure: 1.32, strength: 0.43 }, zoomNormal: [0,0.526,0.851] },
    stellated:    { hasGrid: true, defaultSize: 0.45, defaultRound: 0.0,  glow: 0.59, glowWidth: 0.006, complexity: 1.0, fresnelPower: 3.5, envIntensity: 13.4, eta: 3.01, scale: 3, bloom: { exposure: 0.65, strength: 0.3 }, zoomNormal: [0.577,0.577,0.577] },
    compound:     { hasGrid: true, defaultSize: 0.42, defaultRound: 0.0,  glow: 0.59, glowWidth: 0.006, complexity: 1.0, fresnelPower: 3.5, envIntensity: 13.4, eta: 3.01, scale: 3, bloom: { exposure: 0.65, strength: 0.3 }, zoomNormal: [0,0,1] },
  };

  // Shape grid configurations: faceNormals + apothem for lattice grid
  const SHAPE_GRID_CONFIG = {
    octahedron: {
      apothem: 0.26,
      faceNormals: [[1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]],
      linesPerAxis: 3,
    },
    icosahedron: {
      apothem: 0.55,
      // Grid uses octahedral lattice (4 axes) for clean triangular pattern
      faceNormals: [[1,1,1],[1,1,-1],[1,-1,1],[-1,1,1]],
      linesPerAxis: 3,
    },
    dodecahedron: {
      apothem: 0.55,
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
      uniform float shapeSize;
      uniform float shapeRound;
      uniform float edgeGlow;
      uniform float uIridMode;
      uniform float uIridStrength;
      uniform float uIridHue;
      uniform sampler2D iridLUT;

      #define SIZE vec3(shapeSize)
      #define RAD shapeRound
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

      vec3 iridescence(float t) {
        if (uIridMode < 0.5) return vec3(1.0);
        if (uIridMode < 1.5) {
          // Cosine palette (Inigo Quilez) — RGB phases 0 / 1/3 / 2/3
          return 0.5 + 0.5 * cos(6.28318 * (uIridHue + t + vec3(0.0, 0.333, 0.667)));
        }
        if (uIridMode < 2.5) {
          // LUT sample — 1D gradient from iridescence.png
          return texture2D(iridLUT, vec2(fract(t + uIridHue), 0.5)).rgb;
        }
        // Thin-film dispersion — wavelength-weighted phase (R/G/B = 650/550/440 nm)
        vec3 lambda = vec3(1.0, 0.87, 0.68);
        return 0.5 + 0.5 * cos(6.28318 * (t / lambda + uIridHue));
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

        float fr = fresnel(rd, nor);
        vec3 iridTint = mix(vec3(1.0), iridescence(fr) * 1.8, uIridStrength);
        vec3 color = getEnv(hitPos, reflect(rd, nor)) * fr * iridTint;

        float cosI = dot(rd, nor);
        float k = cosI * cosI + eta * eta - 1.0;
        if (k >= 0.0) {
          vec3 refDir = normalize(nor * (sqrt(k) + cosI) - rd);
          float power = 1.0 - fresnel(refDir, -nor);

          if (gridEnabled > 0.5) {
            float edge = shapeEdge(hitPos);
            if (edge > 0.5 && edgeGlow > 0.01) {
              color += lightColor * iridTint * power * edgeGlow;
            } else {
              vec3 f = ${gridFuncName}(hitPos, refDir);
              color += pow(glow, f.x) * f.z * power * lightColor * iridTint;
            }
          } else {
            color += getEnv(hitPos, refDir) * power * lightColor * iridTint;
          }
        }

        color = max(vec3(0.0), color + (fract(sin(dot(vPos.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  // === Infinite Cube — Custom Raymarched Glass Shader ===
  const cubeGeo = new THREE.BoxGeometry(2.50, 2.50, 2.50);
  const cubeMat = new THREE.ShaderMaterial({
    uniforms: {
      cam: { value: new THREE.Vector3() },
      eta: { value: 1.75 },
      glow: { value: 0.57 },
      glowWidth: { value: 0.008 },
      lightColor: { value: new THREE.Color(0xd49c4d) },
      complexity: { value: 1.0 },
      envIntensity: { value: 5.0 },
      lightMatrix: { value: new THREE.Matrix4() },
      seconds: { value: 0 },
      fresnelPower: { value: 3.0 },
      gridScale: { value: 1.0 },
      gridEnabled: { value: 1.0 },
      cellScale: { value: 1.0 },
      shapeSize: { value: 0.48 },
      shapeRound: { value: 0.02 },
      edgeGlow: { value: 1.0 },
      uIridMode: { value: 0.0 },
      uIridStrength: { value: 1.0 },
      uIridHue: { value: 0.0 },
      iridLUT: { value: iridLUT },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: GLASS_FRAG,
    side: THREE.DoubleSide,
    transparent: false,
  });
  const infiniteCube = new THREE.Mesh(cubeGeo, cubeMat);
  infiniteCube.scale.setScalar(3);
  scene.add(infiniteCube);

  // Point light inside for bloom glow
  const lanternLight = new THREE.PointLight(0xd49c4d, 5, 10);
  lanternLight.position.set(0, 0, 0);
  scene.add(lanternLight);

  // Pre-allocated objects reused every frame (avoid per-frame GC pressure)
  const _lightObj = new THREE.Object3D();
  _lightObj.position.set(0, 0, 3);
  _lightObj.lookAt(0, 0, 0);
  _lightObj.scale.set(10, 2, 1);
  _lightObj.updateMatrixWorld();
  const _invQuat = new THREE.Quaternion();
  const _camLocal = new THREE.Vector3();

  // Raycaster for cursor-light projection
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();

  window.addEventListener('mousemove', (e) => {
    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Cursor light
  const cursorLight = new THREE.PointLight(0xd49c4d, 5, 12);
  scene.add(cursorLight);
  const cursorWorldPos = new THREE.Vector3();

  // Lighting: IBL + minimal ambient
  scene.add(new THREE.AmbientLight(0x080810, 0.5));


  // ============================================================
  // === Particles — GPU compute, LAB color space
  // ============================================================
  // PARTICLES (wrapped in rebuildParticles for Count dropdown)
  // ============================================================
  let PARTICLE_COUNT = 4096;
  let GPU_RES = 64;
  let gpuCompute, dtPosition, dtVelocity, dtGrid;
  let positionVariable, velocityVariable, gpuError;
  let pGeo, particleMat, particleSystem;

  function rebuildParticles(textureSize) {
    // Preserve existing uniform values (if a previous material exists)
    const prevUni = particleMat ? particleMat.uniforms : null;
    const prevPosUni = positionVariable ? positionVariable.material.uniforms : null;

    // Dispose old
    if (particleSystem) {
      scene.remove(particleSystem);
    }
    if (pGeo) pGeo.dispose();
    if (particleMat) particleMat.dispose();
    if (gpuCompute) {
      try {
        if (gpuCompute.variables) {
          gpuCompute.variables.forEach(v => {
            if (v.renderTargets) v.renderTargets.forEach(rt => rt.dispose && rt.dispose());
            if (v.material) v.material.dispose();
          });
        }
      } catch (e) { /* best-effort disposal */ }
    }

    GPU_RES = textureSize;
    PARTICLE_COUNT = textureSize * textureSize;

  // ============================================================

  // --- GPU Compute for particle positions & velocities ---
  gpuCompute = new GPUComputationRenderer(GPU_RES, GPU_RES, renderer);

  // Create initial textures
  dtPosition = gpuCompute.createTexture();
  dtVelocity = gpuCompute.createTexture();
  dtGrid = gpuCompute.createTexture();

  // Fill position texture: random positions in [-10, 10]
  {
    const d = dtPosition.image.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.random() * 20 - 10;
      d[i + 1] = Math.random() * 20 - 10;
      d[i + 2] = Math.random() * 20 - 10;
      d[i + 3] = 1;
    }
  }

  // Fill velocity texture: random velocities in [-0.05, 0.05]
  {
    const d = dtVelocity.image.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.random() * 0.1 - 0.05;
      d[i + 1] = Math.random() * 0.1 - 0.05;
      d[i + 2] = Math.random() * 0.1 - 0.05;
      d[i + 3] = Math.random() - 0.5;
    }
  }

  // Fill grid texture — uniform random positions + velocities
  {
    const d = dtGrid.image.data;
    for (let i = 0; i < d.length; i += 4) {
      let n = (i / 4) % GPU_RES / GPU_RES - 0.5;
      let ii = Math.floor(i / 4 / GPU_RES) / GPU_RES - 0.5;
      n *= 10;
      ii *= 10;
      d[i]     = n;
      d[i + 1] = -ii / 10;
      d[i + 2] = ii;
      d[i + 3] = 1;
    }
  }

  // Position compute shader — integrates velocity into position each frame
  const positionShader = `
    #define delta (1.0 / 60.0)
    uniform float uGrid;
    uniform float uSine;
    uniform sampler2D grid;
    uniform float time;

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 tmpPos = texture2D(texturePosition, uv);
      vec4 gridPos = texture2D(grid, uv);
      vec3 pos = tmpPos.xyz;
      vec4 tmpVel = texture2D(textureVelocity, uv);
      vec3 vel = tmpVel.xyz;
      float age = tmpVel.w;
      if (age == 0.0) { vel = vec3(0.0); }
      pos += vel * delta;
      pos = mix(pos, gridPos.xyz, uGrid);
      vec3 sinePos = gridPos.xyz + 0.4 * vec3(0., sin(gridPos.x * 1.0 + time * 0.1), 0.0);
      sinePos.y += 0.4 * sin(sinePos.y + 0.1);
      pos = mix(pos, sinePos, uSine);
      gl_FragColor = vec4(pos, age);
    }
  `;

  // Velocity compute shader — curl-noise advection + focus attractor
  const velocityShader = `
    #include <common>
    #define delta (1.0 / 60.0)
    uniform mat4 projMatrix;
    uniform mat4 mvMatrix;
    uniform sampler2D fluidMap;

    float PHI = 1.61803398874989484820459;

    float gold_noise(in vec2 xy, in float seed) {
      return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
    }

    mat3 rotation3dY(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 tmpPos = texture2D(texturePosition, uv);
      vec3 pos = tmpPos.xyz;
      vec4 tmpVel = texture2D(textureVelocity, uv);
      vec3 vel = tmpVel.xyz;

      vel = rotation3dY(0.005) * vel;

      gl_FragColor = vec4(vel, 1.0);
    }
  `;

  positionVariable = gpuCompute.addVariable('texturePosition', positionShader, dtPosition);
  velocityVariable = gpuCompute.addVariable('textureVelocity', velocityShader, dtVelocity);

  gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
  gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

  // Position uniforms
  positionVariable.material.uniforms.uGrid = { value: 0.0 };
  positionVariable.material.uniforms.uSine = { value: 0.0 };
  positionVariable.material.uniforms.grid = { value: dtGrid };
  positionVariable.material.uniforms.time = { value: 0.0 };

  // Velocity uniforms
  velocityVariable.material.uniforms.projMatrix = { value: camera.projectionMatrix };
  velocityVariable.material.uniforms.mvMatrix = { value: camera.matrixWorldInverse };
  velocityVariable.material.uniforms.fluidMap = { value: fluidDensityA.texture };

  // Wrap mode
  positionVariable.wrapS = THREE.RepeatWrapping;
  positionVariable.wrapT = THREE.RepeatWrapping;
  velocityVariable.wrapS = THREE.RepeatWrapping;
  velocityVariable.wrapT = THREE.RepeatWrapping;

  gpuError = gpuCompute.init();
  if (gpuError) console.error('GPU Compute error:', gpuError);

  // --- Particle geometry & mesh ---
  pGeo = new THREE.BufferGeometry();
  const positions = [];
  const aRandom = [];
  const aSizes = [];
  const aColors = [];
  let aUvs = new Float32Array(PARTICLE_COUNT * 2);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions.push(0, 0, 0);
    aRandom.push(Math.random(), Math.random(), Math.random());
    aSizes.push(Math.random());
    aColors.push(Math.random());
  }

  // UV grid — maps each particle to its slot in the compute texture
  let uvIdx = 0;
  for (let y = 0; y < GPU_RES; y++) {
    for (let x = 0; x < GPU_RES; x++) {
      aUvs[uvIdx++] = x / (GPU_RES - 1);
      aUvs[uvIdx++] = y / (GPU_RES - 1);
    }
  }

  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  pGeo.setAttribute('aRandom', new THREE.Float32BufferAttribute(aRandom, 3));
  pGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(aSizes, 1));
  pGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(aColors, 1));
  pGeo.setAttribute('aUv', new THREE.Float32BufferAttribute(aUvs, 2));

  // Particle shader material — points with depth-based size and LAB-sampled color
  particleMat = new THREE.ShaderMaterial({
    uniforms: {
      uFocus: { value: 0.9 },
      uFocusDistance: { value: 3.0 },
      uSize: { value: 0.01 },
      texturePosition: { value: null },
      textureVelocity: { value: null },
      fluidMap: { value: fluidDensityA.texture },
      seconds: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aRandom;
      attribute float aColor;
      attribute float aSize;
      attribute vec2 aUv;

      varying float vDepth;
      varying float vColor;
      varying float vfl;

      uniform float uFocus;
      uniform float uFocusDistance;
      uniform sampler2D texturePosition;
      uniform sampler2D fluidMap;

      void main() {
        vColor = aColor;

        vec3 pos = texture2D(texturePosition, aUv).xyz;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vec4 ndcPos = projectionMatrix * viewMatrix * vec4(pos, 1.0);
        vec2 fluidUV = ndcPos.xy / ndcPos.w * 0.5 + 0.5;
        vec4 fluid = texture2D(fluidMap, fluidUV);
        vec3 z = normalize(cameraPosition - worldPos.xyz);
        vec3 x = normalize(cross(worldPos.xyz, vec3(0., 1., 0.)));
        vec3 y = normalize(cross(x, z));
        pos -= (fluid.x * x - fluid.z * y) * 1e-3;
        vfl = length(fluid.xyz);

        vDepth = mix(abs(uFocusDistance - length(worldPos.xyz - cameraPosition)) * 3., 0., uFocus);

        gl_PointSize = aSize * 5.0;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vDepth;
      varying float vColor;
      varying float vfl;

      float circle(in vec2 _st, in float _radius, in float _blur) {
        vec2 dist = _st - vec2(0.5);
        return 1.0 - smoothstep(_radius - (_radius * _blur), _radius + (_radius * 0.01), dot(dist, dist) * 4.0);
      }

      vec3 rgb2xyz(vec3 c) {
        vec3 tmp;
        tmp.x = (c.r > 0.04045) ? pow((c.r + 0.055) / 1.055, 2.4) : c.r / 12.92;
        tmp.y = (c.g > 0.04045) ? pow((c.g + 0.055) / 1.055, 2.4) : c.g / 12.92;
        tmp.z = (c.b > 0.04045) ? pow((c.b + 0.055) / 1.055, 2.4) : c.b / 12.92;
        return 100.0 * tmp *
          mat3(0.4124, 0.3576, 0.1805,
               0.2126, 0.7152, 0.0722,
               0.0193, 0.1192, 0.9505);
      }

      vec3 xyz2lab(vec3 c) {
        vec3 n = c / vec3(95.047, 100.0, 108.883);
        vec3 v;
        v.x = (n.x > 0.008856) ? pow(n.x, 1.0 / 3.0) : (7.787 * n.x) + (16.0 / 116.0);
        v.y = (n.y > 0.008856) ? pow(n.y, 1.0 / 3.0) : (7.787 * n.y) + (16.0 / 116.0);
        v.z = (n.z > 0.008856) ? pow(n.z, 1.0 / 3.0) : (7.787 * n.z) + (16.0 / 116.0);
        return vec3((116.0 * v.y) - 16.0, 500.0 * (v.x - v.y), 200.0 * (v.y - v.z));
      }

      vec3 rgb2lab(vec3 c) {
        vec3 lab = xyz2lab(rgb2xyz(c));
        return vec3(lab.x / 100.0, 0.5 + 0.5 * (lab.y / 127.0), 0.5 + 0.5 * (lab.z / 127.0));
      }

      vec3 lab2xyz(vec3 c) {
        float fy = (c.x + 16.0) / 116.0;
        float fx = c.y / 500.0 + fy;
        float fz = fy - c.z / 200.0;
        return vec3(
          95.047 * ((fx > 0.206897) ? fx * fx * fx : (fx - 16.0 / 116.0) / 7.787),
          100.000 * ((fy > 0.206897) ? fy * fy * fy : (fy - 16.0 / 116.0) / 7.787),
          108.883 * ((fz > 0.206897) ? fz * fz * fz : (fz - 16.0 / 116.0) / 7.787)
        );
      }

      vec3 xyz2rgb(vec3 c) {
        vec3 v = c / 100.0 * mat3(
          3.2406, -1.5372, -0.4986,
          -0.9689, 1.8758, 0.0415,
          0.0557, -0.2040, 1.0570
        );
        vec3 r;
        r.x = (v.r > 0.0031308) ? ((1.055 * pow(v.r, (1.0 / 2.4))) - 0.055) : 12.92 * v.r;
        r.y = (v.g > 0.0031308) ? ((1.055 * pow(v.g, (1.0 / 2.4))) - 0.055) : 12.92 * v.g;
        r.z = (v.b > 0.0031308) ? ((1.055 * pow(v.b, (1.0 / 2.4))) - 0.055) : 12.92 * v.b;
        return r;
      }

      vec3 lab2rgb(vec3 c) {
        return xyz2rgb(lab2xyz(vec3(100.0 * c.x, 2.0 * 127.0 * (c.y - 0.5), 2.0 * 127.0 * (c.z - 0.5))));
      }

      void main() {
        vec2 st = gl_PointCoord.xy;
        float circleMask = circle(st, 1.0, min(vDepth, 2.5));
        if (circleMask < 0.001) discard;

        vec3 rgb1 = vec3(0.792, 0.859, 0.013);
        vec3 rgb2 = vec3(0.000, 1.000, 1.000);

        vec3 lab1 = rgb2lab(rgb1);
        vec3 lab2 = rgb2lab(rgb2);

        vec3 finalColor = mix(lab1, lab2, vColor);
        finalColor = lab2rgb(finalColor);

        float opacity = clamp(0.1, 1.0, vDepth);
        gl_FragColor = vec4(finalColor * circleMask, circleMask * opacity * 0.5);
        gl_FragColor.rgb += 0.1 * vfl;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  particleSystem = new THREE.Points(pGeo, particleMat);
  particleSystem.frustumCulled = false;
  scene.add(particleSystem);

    // Restore previous uniform values so slider state survives rebuild
    if (prevUni) {
      if (prevUni.uFocus) particleMat.uniforms.uFocus.value = prevUni.uFocus.value;
      if (prevUni.uFocusDistance) particleMat.uniforms.uFocusDistance.value = prevUni.uFocusDistance.value;
    }
    if (prevPosUni) {
      if (prevPosUni.uGrid) positionVariable.material.uniforms.uGrid.value = prevPosUni.uGrid.value;
      if (prevPosUni.uSine) positionVariable.material.uniforms.uSine.value = prevPosUni.uSine.value;
    }
    if (window.scene3d) {
      window.scene3d.gpuCompute = gpuCompute;
      window.scene3d.positionVariable = positionVariable;
      window.scene3d.velocityVariable = velocityVariable;
      window.scene3d.particleMat = particleMat;
      window.scene3d.particleSystem = particleSystem;
    }
  }

  rebuildParticles(64);
  window.rebuildParticles = rebuildParticles;



  // ============================================================
  // === Aurora Ribbons — nested TubeGeometry tori driven by 3-frequency simplex noise
  // ============================================================
  const auroraGroup = new THREE.Group();
  // Camera at (-5,-1.5,6) is ~7.8 units from origin in XZ.
  // With scale 4.5: inner ring r=4.5, middle r=9, outer r=15.75
  // Camera is INSIDE middle+outer rings — they arc overhead.
  // Position above scene so tubes' lower edges enter top of viewport.
  auroraGroup.position.set(0, 10, 0.3); // lift ribbons above the scene so lower edges enter viewport top
  auroraGroup.scale.setScalar(4.5); // ring radii: inner 4.5, middle 9, outer 15.75
  scene.add(auroraGroup);

  function ribbonFieldNoise(x, y, offset) {
    return Math.sin(x * 1.7 + offset * 13.1) * Math.cos(y * 2.3 + offset * 7.7) *
           Math.sin(x * 0.7 + y * 1.3 + offset * 3.3);
  }

  function createAuroraMesh({radius, zOffset, noiseScale, noiseAmplitude, noiseOffset, isred}) {
    const points = [];
    for (let e = 0; e <= 100; e++) {
      const a = e / 100 * Math.PI * 2;
      const n = noiseAmplitude * ribbonFieldNoise(noiseScale * a, e / 100, noiseOffset);
      const l = Math.cos(a) * (radius + n);
      const c = Math.sin(a) * (radius + n);
      points.push(new THREE.Vector3(c, zOffset, l));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 200, 0.9, 2, true); // 200 segments, radius 0.9

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uIntensity: { value: 0.05 },
        uColor: { value: isred ? 1.0 : 0.0 },
        uMode: { value: 0.0 },
        uCustom: { value: new THREE.Color(0xd49c4d) },
        uHueShift: { value: 0.0 },
        uHueSpread: { value: 1.0 },
        uHueSat: { value: 1.0 },
        seconds: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uIntensity;
        uniform float uColor;
        uniform float uMode;
        uniform vec3 uCustom;
        uniform float uHueShift;
        uniform float uHueSpread;
        uniform float uHueSat;
        uniform float seconds;

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }
        varying vec2 vUv;

        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                   -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x_) - 0.5;
          vec3 ox = floor(x_ + 0.5);
          vec3 a0 = x_ - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          // Fragment shader
          float grad = fract(vUv.y * 2.0);
          if (vUv.y > 0.5) grad = 1.0 - grad;

          float noise = 0.5 + 0.5 * (
            0.5 * snoise(vec2(vUv.x * 50.0, seconds * 0.1)) +
            0.5 * snoise(vec2(vUv.x * 30.0, seconds * 0.05))
          );
          float noise1 = 0.5 + 0.5 * snoise(vec2(vUv.x * 40.0, 2.0 * seconds * 0.15));
          float slowerNoise = snoise(vec2(vUv.y * 5.0, vUv.x * 10.0 + 2.0 * seconds * 0.05));

          float bottomFill = smoothstep(0.6, 1.0, grad);
          float fadeTop = smoothstep(0.0, 0.8, grad - 0.3 * noise1);
          float fadeBottom = smoothstep(1.0, 0.9, grad);

          slowerNoise *= (1.0 - fadeTop);

          vec3 finalColor = vec3(0.385, 0.50, 0.861);
          vec3 redColor = vec3(0.306, 0.471, 0.462);
          vec3 defaultColor = (uColor > 0.5) ? redColor : finalColor;

          float alpha = fadeBottom * fadeTop * uIntensity;

          vec3 color;
          if (uMode < 0.5) {
            color = defaultColor * (noise + bottomFill);
          } else if (uMode < 1.5) {
            // Rainbow: wide hue sweep — vertical + horizontal + fbm noise.
            // uHueShift rotates the whole palette. uHueSpread tightens/widens
            // the rainbow band. uHueSat controls vividness.
            float hue = (vUv.y * 1.05 + vUv.x * 0.22 + noise * 0.28) * uHueSpread + uHueShift;
            vec3 rainbow = hsv2rgb(vec3(fract(hue), clamp(uHueSat, 0.0, 1.0), 1.0));
            vec3 baseColor = mix(defaultColor * 0.18, rainbow, smoothstep(0.02, 0.55, vUv.y));
            color = baseColor * (noise + bottomFill) * 1.45;
          } else {
            color = uCustom * (noise + bottomFill);
          }

          gl_FragColor = vec4(color, alpha);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Mesh(geo, mat);
  }

  // 6 ribbon configurations — 3 nested tori, each paired with a color-shifted duplicate for blending
  // Inner ring (radius 1 / 0.99) removed per design decision — too tight to the cube/particles.
  auroraGroup.add(createAuroraMesh({radius:2,    zOffset:0,    noiseScale:2, noiseAmplitude:0.2, noiseOffset:0,    isred:false}));
  auroraGroup.add(createAuroraMesh({radius:2.01, zOffset:0.05, noiseScale:2, noiseAmplitude:0.2, noiseOffset:0,    isred:true}));
  auroraGroup.add(createAuroraMesh({radius:3.5,  zOffset:0,    noiseScale:3, noiseAmplitude:0.4, noiseOffset:0.4,  isred:false}));
  auroraGroup.add(createAuroraMesh({radius:3.51, zOffset:0,    noiseScale:3, noiseAmplitude:0.4, noiseOffset:0.45, isred:true}));

  // === Mouse Parallax — spring-damper chasing mouse target ===
  const spring = {
    value: [0, 0], target: [0, 0], velocity: [0, 0],
    k: 10, damp: 5
  };
  const shiftMultiplier = 0.2 * 5;

  window.addEventListener('mousemove', (e) => {
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -((e.clientY / window.innerHeight) * 2 - 1);
    spring.target = [-ndcX, -ndcY];
  });

  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const baseCamPos = camera.position.clone();
  const target = new THREE.Vector3(0, 0, 0);
  let prevTime = performance.now();
  let elapsedSeconds = 0;

  // === Extend scene3d API for constructor panel ===
  Object.assign(window.scene3d, {
    cubeMat, infiniteCube, bloomPass, particleMat,
    auroraGroup, gpuCompute, positionVariable, velocityVariable,
    lanternLight, cursorLight, baseCamPos,
    setShape: function setShapeImpl(name) {
      if (name === 'cube') {
        cubeMat.fragmentShader = GLASS_FRAG;
      } else {
        cubeMat.fragmentShader = buildFragmentShader(name);
      }
      cubeMat.needsUpdate = true;
      const newGeo = new THREE.BoxGeometry(2.50, 2.50, 2.50);
      infiniteCube.geometry.dispose();
      infiniteCube.geometry = newGeo;
      // Auto-set grid and per-shape size/round defaults
      const meta = (typeof SHAPE_META !== 'undefined') ? SHAPE_META[name] : null;
      const hasGrid = meta ? meta.hasGrid : (name === 'cube');
      if (typeof config !== 'undefined') {
        config.object.gridEnabled = hasGrid;
        if (meta) {
          config.object.shapeSize = meta.defaultSize;
          config.object.shapeRound = meta.defaultRound;
          if (meta.glow !== undefined) config.object.glow = meta.glow;
          if (meta.complexity !== undefined) config.object.complexity = meta.complexity;
          // Clear any lingering presentation tween override so uniforms fall back to SHAPE_META
          delete config.object._glowWidthOverride;
          delete config.object._fresnelOverride;
          delete config.object._envIntensityOverride;
          if (meta.eta !== undefined) config.object.eta = meta.eta;
          if (meta.scale !== undefined) config.object.scale = meta.scale;
          if (meta.bloom) {
            if (meta.bloom.exposure !== undefined) config.bloom.exposure = meta.bloom.exposure;
            if (meta.bloom.strength !== undefined) config.bloom.strength = meta.bloom.strength;
          }
        }
        if (cubeMat.uniforms.gridEnabled) cubeMat.uniforms.gridEnabled.value = hasGrid ? 1.0 : 0.0;
        if (cubeMat.uniforms.shapeSize) cubeMat.uniforms.shapeSize.value = config.object.shapeSize;
        if (cubeMat.uniforms.shapeRound) cubeMat.uniforms.shapeRound.value = config.object.shapeRound;
        // Update toggle in UI if exists
        const toggle = document.getElementById('toggle-grid-enabled');
        if (toggle) toggle.classList.toggle('active', hasGrid);
      }
    },
  });

  function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(33, time - prevTime) * 0.001;
    prevTime = time;
    elapsedSeconds += dt;

    // Spring update
    for (let i = 0; i < 2; i++) {
      const force = (spring.target[i] - spring.value[i]) * spring.k;
      const damping = spring.velocity[i] * spring.damp;
      spring.velocity[i] += (force - damping) * dt;
      spring.value[i] += spring.velocity[i] * dt;
    }

    // Camera orbit (reads from global config)
    if (typeof config !== 'undefined' && config.camera.orbit) {
      // Scale-dependent orbit damping + per-frame integration (match index.html)
      const _s = Math.max(1.0, (config.object && config.object.scale) || 3);
      const _orbitMult = 0.15 * Math.min(1.0, Math.sqrt(3.0 / _s));
      if (window._orbitLastT === undefined) window._orbitLastT = elapsedSeconds;
      if (window._orbitAccum === undefined) window._orbitAccum = 0;
      const _dt = Math.max(0, Math.min(0.1, elapsedSeconds - window._orbitLastT));
      window._orbitLastT = elapsedSeconds;
      const _sm = 1 + config.camera.speedVariation * Math.sin(elapsedSeconds * config.camera.orbitSpeed * 0.3);
      window._orbitAccum += _dt * config.camera.orbitSpeed * _sm * _orbitMult;
      let angle = window._orbitAccum;
      if (window._orbitAngleOffset !== undefined) {
        if (window._orbitAngleBase === undefined) window._orbitAngleBase = window._orbitAccum;
        angle = window._orbitAngleOffset + (window._orbitAccum - window._orbitAngleBase);
      }
      const r = config.camera.distance;
      baseCamPos.set(Math.sin(angle) * r, 0.5, Math.cos(angle) * r);
    } else {
      window._orbitLastT = undefined;
    }

    // Reset camera
    camera.position.copy(baseCamPos);
    camera.lookAt(target);
    camera.updateMatrix();

    cameraRight.set(camera.matrix.elements[0], camera.matrix.elements[1], camera.matrix.elements[2]).normalize();
    cameraUp.set(camera.matrix.elements[4], camera.matrix.elements[5], camera.matrix.elements[6]).normalize();

    // Mouse parallax + idle sine drift
    const dist = camera.position.distanceTo(target);
    const sx = spring.value[0] + 0.1 * Math.sin(2 * Math.PI * elapsedSeconds / 17);
    const sy = spring.value[1] + 0.1 * Math.sin(2 * Math.PI * elapsedSeconds / 13);
    const pStr = (typeof config !== 'undefined') ? config.camera.parallaxStrength : 1.0;
    camera.position.addScaledVector(cameraRight, sx * shiftMultiplier * dist * pStr);
    camera.position.addScaledVector(cameraUp, sy * shiftMultiplier * dist * pStr);
    camera.lookAt(target);

    // Cursor light
    raycaster.setFromCamera(mouseNDC, camera);
    cursorWorldPos.copy(raycaster.ray.direction).multiplyScalar(5).add(camera.position);
    cursorLight.position.lerp(cursorWorldPos, 0.15);
    cursorLight.intensity = 4 + Math.sin(elapsedSeconds * 4) * 1;

    cubeMat.uniforms.eta.value = config.object.eta;

    // Update cube shader camera (reuse pre-allocated objects — no per-frame allocation)
    _invQuat.copy(infiniteCube.quaternion).conjugate();
    _camLocal.copy(camera.position)
      .sub(infiniteCube.position)
      .divideScalar(infiniteCube.scale.x)
      .applyQuaternion(_invQuat);
    cubeMat.uniforms.cam.value.copy(_camLocal);
    cubeMat.uniforms.seconds.value = elapsedSeconds;

    // Light matrix — _lightObj is constant, no need to update every frame;
    // matrix was computed once at creation time.
    cubeMat.uniforms.lightMatrix.value.copy(_lightObj.matrixWorld).invert();

    infiniteCube.scale.setScalar(config.object.scale);

    // === GPU Compute particle update ===
    positionVariable.material.uniforms.time.value = elapsedSeconds;
    velocityVariable.material.uniforms.fluidMap.value = fluidDensityA.texture;
    velocityVariable.material.uniforms.projMatrix.value = camera.projectionMatrix;
    velocityVariable.material.uniforms.mvMatrix.value = camera.matrixWorldInverse;
    gpuCompute.compute();

    particleMat.uniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
    particleMat.uniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
    particleMat.uniforms.fluidMap.value = fluidDensityA.texture;
    particleMat.uniforms.seconds.value = elapsedSeconds;

    // Update fluid simulation
    updateFluidSim();
    fluidPass.uniforms.fluidMap.value = fluidDensityA.texture;

    // Update aurora time
    auroraGroup.children.forEach(mesh => {
      if (mesh.material.uniforms) mesh.material.uniforms.seconds.value = elapsedSeconds;
    });

    composer.render();
  }

  // Apply the configured shape BEFORE the first frame renders, so the scene
  // doesn't flash the boot-state cube before settling on the configured one.
  if (typeof config !== 'undefined' && config.object && config.object.shape
      && config.object.shape !== 'cube'
      && typeof window.scene3d.setShape === 'function') {
    window.scene3d.setShape(config.object.shape);
  }

  animate(performance.now());

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    fluidPass.uniforms.pixelSize.value.set(1.0 / window.innerWidth, 1.0 / window.innerHeight);
  });

  // ============================================================
  // === Gyroscope input — phone tilt dispatches synthetic mousemove
  // so the cursor light and parallax spring both react to device
  // orientation on mobile without duplicating listeners.
  // ============================================================
  (function setupGyro() {
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
      || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)); // iPadOS reports as Mac
    if (!isMobile) return;

    let active = false, hasSample = false;
    let tx = window.innerWidth * 0.5, ty = window.innerHeight * 0.5;
    let cx = tx, cy = ty;

    // Smoothing loop — lerp synthetic cursor toward target, then dispatch
    // a MouseEvent so every existing mousemove handler picks it up.
    function tick() {
      if (active && hasSample) {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        try {
          window.dispatchEvent(new MouseEvent('mousemove', {
            clientX: cx, clientY: cy, bubbles: true, cancelable: true
          }));
        } catch (_) {}
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function orient() {
      const a = (screen.orientation && screen.orientation.angle)
        || window.orientation || 0;
      return a;
    }

    function onOrientation(e) {
      if (e.beta == null || e.gamma == null) return;
      const rot = orient();
      let gx, gy;
      if (rot === 90) { gx = e.beta;  gy = -e.gamma; }
      else if (rot === -90 || rot === 270) { gx = -e.beta; gy = e.gamma; }
      else if (rot === 180) { gx = -e.gamma; gy = -(e.beta - 45); }
      else { gx = e.gamma;  gy = e.beta - 45; } // portrait default
      gx = Math.max(-30, Math.min(30, gx));
      gy = Math.max(-30, Math.min(30, gy));
      tx = window.innerWidth  * (0.5 + gx / 60);
      ty = window.innerHeight * (0.5 + gy / 60);
      if (!hasSample) { cx = tx; cy = ty; hasSample = true; }
      active = true;
    }

    function attach() {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
    }

    const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (!needsPermission) { attach(); return; }

    const btn = document.createElement('button');
    btn.textContent = 'Enable tilt';
    btn.setAttribute('aria-label', 'Enable gyroscope tilt control');
    btn.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'padding:10px 18px',
      'background:rgba(212,156,77,0.92)',
      'color:#0b0b0b',
      'border:none',
      'border-radius:999px',
      'font-family:Inter,system-ui,sans-serif',
      'font-size:13px',
      'font-weight:500',
      'letter-spacing:0.02em',
      'z-index:9999',
      'cursor:pointer',
      'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
      'backdrop-filter:blur(6px)'
    ].join(';');
    btn.addEventListener('click', async () => {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') attach();
      } catch (_) { /* user denied or unsupported */ }
      btn.remove();
    });
    if (document.body) document.body.appendChild(btn);
    else window.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));
  })();
