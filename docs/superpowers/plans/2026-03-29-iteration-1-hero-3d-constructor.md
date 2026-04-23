# Iteration 1: Hero + 3D + Constructor Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working single-file HTML page with Hero section, 3D WebGL tower scene, Lenis smooth scroll, GSAP animations, and a constructor panel with sliders + export.

**Architecture:** Single `index.html` file. CDN libraries (GSAP 3.13.0, Lenis 1.0.42, Three.js r172, Tailwind CDN). Assets served from `assets/` directory. All CSS in `<style>`, all JS in `<script>` tags. Must be served via local HTTP server (for GLB/texture loading).

**Tech Stack:** GSAP 3.13.0 + ScrollTrigger, Lenis 1.0.42, Three.js r172 (+ GLTFLoader, RGBELoader, PMREMGenerator from three addons CDN), Tailwind CSS CDN.

**Important:** Three.js r172 core CDN (`three.min.js`) does NOT include GLTFLoader or texture loaders. These must be loaded as ES modules from the Three.js addons CDN via `<script type="importmap">` + `<script type="module">`.

---

## File Map

| File | Purpose |
|------|---------|
| `index.html` | Single file: HTML structure, CSS, JS for all components |
| `assets/*` | Pre-downloaded assets (GLB, textures, fonts, SVGs) |

---

### Task 1: HTML Shell + CDN + CSS Foundation

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create the base HTML with CDN scripts and CSS custom properties**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>hypercube — Block Constructor</title>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- GSAP 3.13.0 + ScrollTrigger -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>

  <!-- Lenis 1.0.42 -->
  <script src="https://unpkg.com/lenis@1.0.42/dist/lenis.min.js"></script>

  <!-- Three.js r172 import map (for ES module addons) -->
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.172.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.172.0/examples/jsm/"
    }
  }
  </script>

  <style>
    /* === Font === */
    @font-face {
      font-family: 'mosvita';
      src: url('assets/mosvita.woff2') format('woff2'),
           url('assets/mosvita.ttf') format('truetype');
      font-weight: 100 900;
      font-display: swap;
    }

    /* === CSS Custom Properties (Design Tokens) === */
    :root {
      --bg-black: #000000;
      --bg-white: #ffffff;
      --bg-gray-light: #f4f4f4;
      --text-white: 255, 255, 255;
      --text-gray-1: 187, 187, 187;
      --text-gray-2: 165, 165, 165;
      --text-gold: 212, 156, 77;
      --text-dark-1: 17, 17, 17;
      --text-dark-2: 38, 38, 38;
      --text-dark-3: 113, 113, 113;
      --border-white-10: rgba(255, 255, 255, 0.1);

      /* Constructor-controlled */
      --hero-h1-size: 64px;
      --hero-h1-weight: 300;
      --base-font-size: 16px;
      --line-height-base: 1.5;
      --accent-color: rgb(var(--text-gold));
      --bg-primary: var(--bg-black);
      --text-primary: rgb(var(--text-white));
    }

    /* === Reset & Base === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html {
      font-family: 'mosvita', 'Inter', Arial, sans-serif;
      font-size: var(--base-font-size);
      line-height: var(--line-height-base);
      background: var(--bg-primary);
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }

    html.lenis, html.lenis body {
      height: auto;
    }

    .lenis.lenis-smooth {
      scroll-behavior: auto !important;
    }

    .lenis.lenis-smooth [data-lenis-prevent] {
      overscroll-behavior: contain;
    }

    body {
      overflow-x: hidden;
    }

    /* === GL Container (fixed background) === */
    .gl-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: -1;
      pointer-events: none;
    }

    .gl-container canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }

    /* === Preloader === */
    #preloader {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.5s ease;
    }

    #preloader.hidden {
      opacity: 0;
      pointer-events: none;
    }

    #preloader-counter {
      font-size: 48px;
      font-weight: 300;
      color: rgb(var(--text-gold));
    }
  </style>
</head>
<body>
  <!-- Preloader -->
  <div id="preloader">
    <span id="preloader-counter">0%</span>
  </div>

  <!-- WebGL Canvas -->
  <div class="gl-container">
    <canvas id="webgl"></canvas>
  </div>

  <!-- Content will be added in subsequent tasks -->

</body>
</html>
```

- [ ] **Step 2: Verify the file loads in browser**

Run: `cd "/Users/egor/cloud project/reverse 1 " && python3 -m http.server 8080`

Open http://localhost:8080 — should see black page with gold "0%" preloader counter. Check browser console for no errors. Tailwind loaded, fonts applied.

- [ ] **Step 3: Commit**

```bash
git init
git add index.html
git commit -m "feat: HTML shell with CDN scripts, CSS tokens, preloader"
```

---

### Task 2: Header (Fixed Navigation)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add header HTML after the gl-container div**

Insert after `<div class="gl-container">...</div>`:

```html
  <!-- Header -->
  <header id="site-header" class="fixed box-border z-40 top-0 left-0 right-0 py-2 transition-all duration-300">
    <div class="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-14">
      <!-- Logo SVG (gold) -->
      <a href="#" class="flex-shrink-0">
        <svg width="120" height="75" viewBox="0 0 384 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M78.9783 189.035C78.9783 190.175 79.1578 191.21 79.5167 192.139C79.8756 193.046 80.4033 193.817 81.1 194.45C81.7967 195.084 82.6411 195.569 83.6333 195.907C84.6256 196.224 85.7761 196.382 87.085 196.382C88.0561 196.382 88.9217 196.297 89.6817 196.129C90.4628 195.939 91.1489 195.664 91.74 195.305C92.3311 194.946 92.8272 194.503 93.2283 193.975C93.6294 193.447 93.9461 192.856 94.1783 192.202H98.2317C98.0417 193.574 97.5983 194.777 96.9017 195.812C96.205 196.846 95.3394 197.701 94.305 198.377C93.2706 199.052 92.0989 199.57 90.79 199.929C89.5022 200.266 88.1617 200.435 86.7683 200.435C84.995 200.435 83.3589 200.182 81.86 199.675C80.3822 199.147 79.0944 198.398 77.9967 197.427C76.92 196.456 76.0756 195.263 75.4633 193.849C74.8511 192.434 74.545 190.83 74.545 189.035C74.545 187.22 74.8511 185.605 75.4633 184.19C76.0967 182.776 76.9517 181.583 78.0283 180.612C79.1261 179.641 80.4244 178.902 81.9233 178.395C83.4433 177.889 85.09 177.635 86.8633 177.635C88.2567 177.635 89.5972 177.804 90.885 178.142C92.1939 178.459 93.3656 178.965 94.4 179.662C95.4344 180.337 96.2894 181.214 96.965 182.29C97.6617 183.367 98.0839 184.665 98.2317 186.185H94.1783C93.9672 185.446 93.6611 184.802 93.26 184.254C92.8589 183.684 92.3628 183.209 91.7717 182.829C91.2017 182.449 90.5156 182.153 89.7133 181.942C88.9322 181.731 88.035 181.625 87.0217 181.625C85.7339 181.625 84.5939 181.794 83.6017 182.132C82.6094 182.47 81.765 182.966 81.0683 183.62C80.3928 184.254 79.8756 185.024 79.5167 185.932C79.1578 186.84 78.9783 187.874 78.9783 189.035ZM113.065 196.35C114.311 196.35 115.451 196.171 116.485 195.812C117.52 195.432 118.406 194.925 119.145 194.292C119.905 193.637 120.496 192.856 120.919 191.949C121.362 191.041 121.584 190.059 121.584 189.004C121.584 187.948 121.372 186.977 120.95 186.09C120.528 185.182 119.937 184.401 119.177 183.747C118.417 183.092 117.509 182.586 116.454 182.227C115.419 181.847 114.3 181.657 113.097 181.657C111.872 181.657 110.743 181.847 109.709 182.227C108.674 182.586 107.777 183.092 107.017 183.747C106.257 184.401 105.655 185.182 105.212 186.09C104.79 186.977 104.579 187.959 104.579 189.035C104.579 190.091 104.79 191.072 105.212 191.98C105.655 192.867 106.257 193.637 107.017 194.292C107.777 194.925 108.674 195.432 109.709 195.812C110.743 196.171 111.862 196.35 113.065 196.35ZM100.367 189.004C100.367 187.294 100.715 185.742 101.412 184.349C102.109 182.934 103.037 181.731 104.199 180.739C105.36 179.746 106.711 178.986 108.252 178.459C109.814 177.91 111.45 177.635 113.16 177.635C114.87 177.635 116.485 177.91 118.005 178.459C119.525 178.986 120.866 179.746 122.027 180.739C123.188 181.731 124.106 182.934 124.782 184.349C125.457 185.742 125.795 187.294 125.795 189.004C125.795 190.735 125.457 192.307 124.782 193.722C124.106 195.115 123.188 196.308 122.027 197.3C120.866 198.292 119.515 199.063 117.974 199.612C116.454 200.161 114.828 200.435 113.097 200.435C111.387 200.435 109.761 200.161 108.22 199.612C106.679 199.063 105.328 198.292 104.167 197.3C103.006 196.308 102.077 195.115 101.38 193.722C100.705 192.307 100.367 190.735 100.367 189.004ZM128.966 200.087V177.984H132.925L147.238 193.722V177.984H151.45V200.087H147.491L133.178 184.222V200.087H128.966ZM162.462 200.087V181.562H154.197V177.984H174.97V181.562H166.673V200.087H162.462ZM177.734 200.087V177.984H181.946V200.087H177.734ZM186.177 200.087V177.984H190.135L204.448 193.722V177.984H208.66V200.087H204.702L190.388 184.222V200.087H186.177ZM212.294 177.984H216.537V190.397C216.537 191.326 216.674 192.17 216.949 192.93C217.244 193.669 217.656 194.313 218.184 194.862C218.733 195.39 219.419 195.801 220.242 196.097C221.065 196.371 222.015 196.509 223.092 196.509C224.19 196.509 225.14 196.361 225.942 196.065C226.765 195.77 227.441 195.358 227.969 194.83C228.497 194.302 228.887 193.659 229.14 192.899C229.415 192.139 229.552 191.305 229.552 190.397V177.984H233.732V190.492C233.732 191.695 233.553 192.899 233.194 194.102C232.856 195.284 232.275 196.34 231.452 197.269C230.629 198.197 229.531 198.957 228.159 199.549C226.808 200.14 225.129 200.435 223.124 200.435C221.097 200.435 219.398 200.14 218.025 199.549C216.653 198.957 215.545 198.197 214.7 197.269C213.856 196.319 213.244 195.252 212.864 194.07C212.484 192.888 212.294 191.695 212.294 190.492V177.984ZM249.04 196.35C250.286 196.35 251.426 196.171 252.46 195.812C253.495 195.432 254.381 194.925 255.12 194.292C255.88 193.637 256.471 192.856 256.894 191.949C257.337 191.041 257.559 190.059 257.559 189.004C257.559 187.948 257.347 186.977 256.925 186.09C256.503 185.182 255.912 184.401 255.152 183.747C254.392 183.092 253.484 182.586 252.429 182.227C251.394 181.847 250.275 181.657 249.072 181.657C247.847 181.657 246.718 181.847 245.684 182.227C244.649 182.586 243.752 183.092 242.992 183.747C242.232 184.401 241.63 185.182 241.187 186.09C240.765 186.977 240.554 187.959 240.554 189.035C240.554 190.091 240.765 191.072 241.187 191.98C241.63 192.867 242.232 193.637 242.992 194.292C243.752 194.925 244.649 195.432 245.684 195.812C246.718 196.171 247.837 196.35 249.04 196.35ZM236.342 189.004C236.342 187.294 236.69 185.742 237.387 184.349C238.084 182.934 239.012 181.731 240.174 180.739C241.335 179.746 242.686 178.986 244.227 178.459C245.789 177.91 247.425 177.635 249.135 177.635C250.845 177.635 252.46 177.91 253.98 178.459C255.5 178.986 256.841 179.746 258.002 180.739C259.163 181.731 260.081 182.934 260.757 184.349C261.432 185.742 261.77 187.294 261.77 189.004C261.77 190.735 261.432 192.307 260.757 193.722C260.081 195.115 259.163 196.308 258.002 197.3C256.841 198.292 255.49 199.063 253.949 199.612C252.429 200.161 250.803 200.435 249.072 200.435C247.362 200.435 245.736 200.161 244.195 199.612C242.654 199.063 241.303 198.292 240.142 197.3C238.981 196.308 238.052 195.115 237.355 193.722C236.68 192.307 236.342 190.735 236.342 189.004ZM264.34 177.984H268.583V190.397C268.583 191.326 268.72 192.17 268.995 192.93C269.29 193.669 269.702 194.313 270.23 194.862C270.779 195.39 271.465 195.801 272.288 196.097C273.111 196.371 274.061 196.509 275.138 196.509C276.236 196.509 277.186 196.361 277.988 196.065C278.811 195.77 279.487 195.358 280.015 194.83C280.542 194.302 280.933 193.659 281.186 192.899C281.461 192.139 281.598 191.305 281.598 190.397V177.984H285.778V190.492C285.778 191.695 285.599 192.899 285.24 194.102C284.902 195.284 284.321 196.34 283.498 197.269C282.675 198.197 281.577 198.957 280.205 199.549C278.854 200.14 277.175 200.435 275.17 200.435C273.143 200.435 271.444 200.14 270.071 199.549C268.699 198.957 267.591 198.197 266.746 197.269C265.902 196.319 265.29 195.252 264.91 194.07C264.53 192.888 264.34 191.695 264.34 190.492V177.984ZM288.324 193.595H293.011C293.117 194.207 293.37 194.714 293.771 195.115C294.193 195.516 294.7 195.833 295.291 196.065C295.882 196.297 296.516 196.456 297.191 196.54C297.888 196.625 298.574 196.667 299.249 196.667C300.284 196.667 301.171 196.593 301.909 196.445C302.669 196.276 303.292 196.055 303.778 195.78C304.263 195.506 304.622 195.189 304.854 194.83C305.108 194.471 305.234 194.081 305.234 193.659C305.234 193.025 304.897 192.54 304.221 192.202C303.546 191.864 302.564 191.547 301.276 191.252L295.988 190.08C294.953 189.848 293.993 189.574 293.106 189.257C292.219 188.919 291.449 188.518 290.794 188.054C290.14 187.568 289.623 186.998 289.243 186.344C288.884 185.689 288.704 184.908 288.704 184C288.704 182.902 289 181.952 289.591 181.15C290.182 180.348 290.963 179.694 291.934 179.187C292.906 178.659 294.014 178.279 295.259 178.047C296.526 177.794 297.835 177.667 299.186 177.667C300.601 177.667 301.909 177.794 303.113 178.047C304.337 178.279 305.403 178.67 306.311 179.219C307.24 179.746 307.968 180.454 308.496 181.34C309.024 182.206 309.319 183.282 309.383 184.57H304.601C304.517 184 304.316 183.525 303.999 183.145C303.683 182.765 303.261 182.459 302.733 182.227C302.226 181.995 301.646 181.836 300.991 181.752C300.358 181.646 299.693 181.594 298.996 181.594C298.194 181.594 297.466 181.646 296.811 181.752C296.157 181.857 295.608 182.026 295.164 182.259C294.721 182.491 294.383 182.776 294.151 183.114C293.919 183.43 293.803 183.8 293.803 184.222C293.803 184.517 293.866 184.792 293.993 185.045C294.141 185.277 294.362 185.499 294.658 185.71C294.974 185.9 295.365 186.08 295.829 186.249C296.294 186.417 296.853 186.565 297.508 186.692L302.543 187.832C303.577 188.064 304.548 188.328 305.456 188.624C306.364 188.898 307.156 189.257 307.831 189.7C308.507 190.144 309.045 190.692 309.446 191.347C309.847 191.98 310.048 192.772 310.048 193.722C310.048 194.841 309.752 195.812 309.161 196.635C308.591 197.459 307.81 198.145 306.818 198.694C305.826 199.242 304.675 199.654 303.366 199.929C302.057 200.203 300.674 200.34 299.218 200.34C297.529 200.34 296.009 200.192 294.658 199.897C293.328 199.58 292.188 199.137 291.238 198.567C290.288 197.976 289.559 197.258 289.053 196.414C288.567 195.569 288.324 194.63 288.324 193.595ZM114.829 232.055L105.677 210.554H108.274L116.285 229.522L124.455 210.554H127.052L117.71 232.055H114.829ZM128.989 232.055V210.554H145.899V212.644H131.395V219.42H144.474V221.415H131.395V229.934H145.709V232.055H128.989ZM149.028 232.055V210.554H151.466L166.951 228.414V210.554H169.358V232.055H166.919L151.434 214.132V232.055H149.028ZM180.883 232.055V212.644H172.396V210.554H191.744V212.644H183.258V232.055H180.883ZM193.887 210.554H196.325V222.619C196.325 223.695 196.463 224.698 196.737 225.627C197.012 226.535 197.444 227.326 198.035 228.002C198.627 228.677 199.397 229.205 200.347 229.585C201.297 229.965 202.458 230.155 203.83 230.155C205.182 230.155 206.332 229.965 207.282 229.585C208.253 229.205 209.034 228.677 209.625 228.002C210.238 227.326 210.681 226.535 210.955 225.627C211.23 224.698 211.367 223.695 211.367 222.619V210.554H213.71V222.777C213.71 224.17 213.51 225.458 213.109 226.64C212.729 227.801 212.138 228.815 211.335 229.68C210.533 230.525 209.509 231.19 208.264 231.675C207.039 232.161 205.572 232.404 203.862 232.404C202.131 232.404 200.643 232.161 199.397 231.675C198.152 231.19 197.117 230.525 196.294 229.68C195.492 228.815 194.89 227.791 194.489 226.609C194.088 225.426 193.887 224.149 193.887 222.777V210.554ZM235.627 232.055H232.967L228.818 223.949H220.427V232.055H218.02V210.554H229.198C229.958 210.554 230.729 210.67 231.51 210.902C232.312 211.113 233.02 211.482 233.632 212.01C234.265 212.517 234.772 213.182 235.152 214.005C235.553 214.829 235.753 215.852 235.753 217.077C235.753 217.985 235.637 218.819 235.405 219.579C235.194 220.339 234.877 221.004 234.455 221.574C234.054 222.144 233.579 222.608 233.03 222.967C232.502 223.305 231.911 223.526 231.257 223.632L235.627 232.055ZM220.427 221.954H229.293C229.821 221.954 230.328 221.88 230.813 221.732C231.299 221.563 231.732 221.289 232.112 220.909C232.492 220.529 232.798 220.022 233.03 219.389C233.262 218.755 233.378 217.974 233.378 217.045C233.378 216.095 233.22 215.335 232.903 214.765C232.587 214.174 232.207 213.731 231.763 213.435C231.341 213.119 230.877 212.907 230.37 212.802C229.885 212.696 229.462 212.644 229.103 212.644H220.427V221.954ZM239.142 232.055V210.554H256.052V212.644H241.548V219.42H254.627V221.415H241.548V229.934H255.862V232.055H239.142ZM257.724 226.925H260.321C260.511 227.537 260.859 228.055 261.366 228.477C261.893 228.899 262.506 229.237 263.202 229.49C263.92 229.744 264.691 229.923 265.514 230.029C266.337 230.134 267.15 230.187 267.952 230.187C269.092 230.187 270.106 230.092 270.992 229.902C271.9 229.691 272.66 229.406 273.272 229.047C273.906 228.688 274.391 228.255 274.729 227.749C275.067 227.221 275.236 226.64 275.236 226.007C275.236 225.12 274.803 224.445 273.937 223.98C273.072 223.495 271.837 223.083 270.232 222.745L264.912 221.637C263.772 221.405 262.769 221.12 261.904 220.782C261.038 220.423 260.321 220.011 259.751 219.547C259.202 219.082 258.79 218.555 258.516 217.964C258.241 217.372 258.104 216.707 258.104 215.969C258.104 214.955 258.378 214.079 258.927 213.34C259.476 212.601 260.194 212.01 261.081 211.567C261.988 211.102 263.012 210.765 264.152 210.554C265.292 210.342 266.453 210.237 267.636 210.237C269.05 210.237 270.306 210.353 271.404 210.585C272.523 210.817 273.483 211.166 274.286 211.63C275.109 212.095 275.763 212.696 276.249 213.435C276.734 214.174 277.051 215.061 277.199 216.095H274.602C274.412 215.377 274.106 214.786 273.684 214.322C273.262 213.836 272.744 213.467 272.132 213.214C271.52 212.939 270.823 212.749 270.042 212.644C269.282 212.538 268.469 212.485 267.604 212.485C266.696 212.485 265.831 212.559 265.007 212.707C264.205 212.834 263.487 213.045 262.854 213.34C262.221 213.636 261.714 214.016 261.334 214.48C260.975 214.924 260.796 215.472 260.796 216.127C260.796 216.507 260.88 216.866 261.049 217.204C261.218 217.52 261.482 217.826 261.841 218.122C262.221 218.396 262.706 218.65 263.297 218.882C263.909 219.114 264.659 219.325 265.546 219.515L270.771 220.655C271.889 220.887 272.892 221.151 273.779 221.447C274.666 221.742 275.404 222.091 275.996 222.492C276.587 222.893 277.041 223.389 277.357 223.98C277.695 224.571 277.864 225.279 277.864 226.102C277.864 227.115 277.611 228.012 277.104 228.794C276.597 229.554 275.89 230.208 274.982 230.757C274.096 231.285 273.04 231.686 271.816 231.96C270.612 232.235 269.303 232.372 267.889 232.372C266.348 232.372 264.965 232.235 263.741 231.96C262.537 231.686 261.503 231.316 260.637 230.852C259.793 230.366 259.117 229.796 258.611 229.142C258.125 228.466 257.829 227.727 257.724 226.925Z" fill="#D49C4D"/>
          <path d="M2 5C31.6253 77.2793 105.518 128.5 192 128.5M2 5C52.4672 50.0533 119.036 77.4375 192 77.4375M2 5V200.937M192 128.5C278.482 128.5 352.375 77.2764 382 5M192 128.5C119.034 128.5 52.4664 155.882 2 200.937M192 128.5C264.966 128.5 331.534 155.885 382 200.937M382 5C331.533 50.0504 264.964 77.4375 192 77.4375M382 5V200.937M192 77.4375C278.48 77.4375 352.375 128.656 382 200.937M192 77.4375C105.52 77.4375 31.622 128.656 2 200.937" stroke="#D49C4D" stroke-width="3.8"/>
        </svg>
      </a>
      <!-- Navigation -->
      <nav class="hidden md:flex items-center gap-8">
        <a href="#" class="text-white text-base font-bold hover:text-[rgb(212,156,77)] transition-colors">Home</a>
        <a href="#" class="text-white text-base font-normal hover:text-[rgb(212,156,77)] transition-colors">D&I</a>
        <a href="#" class="text-white text-base font-normal hover:text-[rgb(212,156,77)] transition-colors">Agency</a>
        <a href="#" class="text-white text-base font-normal hover:text-[rgb(212,156,77)] transition-colors">News</a>
        <a href="#contact" class="text-white text-base font-normal border border-white/30 rounded-full px-5 py-1.5 hover:bg-white/10 transition-all">CONTACT</a>
      </nav>
    </div>
  </header>
```

- [ ] **Step 2: Add header CSS for scroll state**

Add to the `<style>` block:

```css
    /* === Header === */
    #site-header {
      background: transparent;
    }

    #site-header.scrolled {
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }
```

- [ ] **Step 3: Verify header renders**

Reload http://localhost:8080 — header should show gold logo left, nav links right, transparent background. (Preloader will overlay it, but inspect via DevTools.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: fixed header with logo and navigation"
```

---

### Task 3: Hero Section HTML + CSS

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add hero section HTML after the header**

Insert after `</header>`:

```html
  <!-- Hero Section -->
  <section id="hero" class="relative pb-0 md:pb-[190px] md:min-h-[100vh] flex flex-col justify-center">
    <div class="max-w-[1400px] mx-auto px-6 pt-32 md:pt-40">
      <h1 id="hero-h1" class="text-white leading-none mb-6" style="font-size: var(--hero-h1-size); font-weight: var(--hero-h1-weight);">
        Where Others Advise,<br>We Build — With You
      </h1>
      <p id="hero-subtitle" class="text-[rgb(187,187,187)] text-base max-w-[520px] mb-8 leading-relaxed">
        Strategic venture creation that turns bold ideas into market-ready businesses. We embed with founders, validate fast, and build what lasts.
      </p>
      <a href="#contact" id="hero-cta" class="inline-block border border-white/30 rounded-full px-8 py-3 text-white text-base hover:bg-white/10 transition-all">
        Get in touch
      </a>
    </div>
    <div class="absolute bottom-8 right-8 text-right">
      <span class="text-[rgb(212,156,77)] text-sm tracking-wide">Venture Studio | Disruptive Agency</span>
    </div>
  </section>
```

- [ ] **Step 2: Verify hero renders**

Reload — temporarily hide preloader via DevTools (`display:none` on `#preloader`). Hero should show: large H1 in mosvita font, subtitle, CTA button, gold label bottom-right.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: hero section with H1, subtitle, CTA, and label"
```

---

### Task 4: Lenis Smooth Scroll + GSAP Integration

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add a spacer section so we have something to scroll**

Insert after `</section>` (hero):

```html
  <!-- Spacer for scroll testing (remove later) -->
  <div id="scroll-spacer" style="height: 200vh; display: flex; align-items: center; justify-content: center;">
    <p class="text-white/20 text-2xl">↓ Scroll test area ↓</p>
  </div>
```

- [ ] **Step 2: Add Lenis + GSAP initialization script before closing `</body>`**

```html
  <!-- === Lenis + GSAP Initialization === -->
  <script>
    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);

    // Lenis smooth scroll (exact original config)
    const lenis = new Lenis({
      duration: 1.2,
      easing: (e) => Math.min(1, 1.001 - Math.pow(2, -10 * e)),
      touchMultiplier: 2
    });
    window.lenis = lenis;

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  </script>
```

- [ ] **Step 3: Add header scroll behavior script**

Add a second script block after the Lenis init:

```html
  <!-- === Header Scroll Behavior === -->
  <script>
    const header = document.getElementById('site-header');
    ScrollTrigger.create({
      start: "top -80",
      onUpdate: (self) => {
        header.classList.toggle("scrolled", self.scroll() > 80);
      }
    });
  </script>
```

- [ ] **Step 4: Add preloader animation script**

Add after the header scroll script:

```html
  <!-- === Preloader Animation === -->
  <script>
    const preloaderEl = document.getElementById('preloader');
    const counterEl = document.getElementById('preloader-counter');
    const counterObj = { value: 0 };

    gsap.to(counterObj, {
      value: 100,
      duration: 2,
      ease: "power2.inOut",
      onUpdate: () => {
        counterEl.textContent = Math.round(counterObj.value) + "%";
      },
      onComplete: () => {
        preloaderEl.classList.add("hidden");
        setTimeout(() => { preloaderEl.style.display = "none"; }, 500);
        // Trigger hero entrance animation
        animateHeroEntrance();
      }
    });
  </script>
```

- [ ] **Step 5: Add hero entrance animation script**

```html
  <!-- === Hero Animations === -->
  <script>
    function animateHeroEntrance() {
      const tl = gsap.timeline();
      tl.from("#hero-h1", {
        opacity: 0, y: 40, duration: 0.8, ease: "power2.out"
      })
      .from("#hero-subtitle", {
        opacity: 0, y: 40, duration: 0.8, ease: "power2.out"
      }, "-=0.5")
      .from("#hero-cta", {
        opacity: 0, y: 40, duration: 0.8, ease: "power2.out"
      }, "-=0.5");
    }
  </script>
```

- [ ] **Step 6: Verify everything works together**

Reload http://localhost:8080:
1. Preloader counts 0% → 100% with gold text
2. Preloader fades out
3. Hero H1, subtitle, CTA fade in with stagger
4. Smooth scroll works (inertial, buttery feel)
5. Header gets blur/dark background when scrolled past 80px
6. Check console for no errors

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: Lenis smooth scroll, GSAP preloader, hero animations, header scroll"
```

---

### Task 5: Three.js 3D WebGL Scene

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the Three.js module script**

Add as the LAST script in the body (after all other scripts), using `type="module"`:

```html
  <!-- === Three.js 3D Scene === -->
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
    import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

    // Scene setup
    const canvas = document.getElementById('webgl');
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Store references globally for constructor panel
    window.scene3d = { scene, camera, renderer, model: null, material: null };

    // Environment map from env.jpg
    const textureLoader = new THREE.TextureLoader();
    const envTexture = textureLoader.load('assets/env.jpg', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
    });

    // Load GLB model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('assets/tower02.glb', (gltf) => {
      const model = gltf.scene;

      // Apply MeshPhysicalMaterial with iridescence to all meshes
      model.traverse((child) => {
        if (child.isMesh) {
          const mat = new THREE.MeshPhysicalMaterial({
            color: 0xaaaaaa,
            metalness: 0.5,
            roughness: 0.3,
            iridescence: 1.0,
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [100, 400],
            envMapIntensity: 1.0,
          });
          child.material = mat;
          window.scene3d.material = mat;
        }
      });

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDim;
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));

      scene.add(model);
      window.scene3d.model = model;
    });

    // Ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Animation loop with Lenis parallax
    let parallaxSpeed = 0.001;
    window.scene3d.setParallaxSpeed = (v) => { parallaxSpeed = v; };

    function animate() {
      requestAnimationFrame(animate);

      // Parallax from Lenis scroll position
      if (window.lenis && window.scene3d.model) {
        scene.rotation.y = window.lenis.scroll * parallaxSpeed;
      }

      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
```

- [ ] **Step 2: Verify 3D scene renders**

Reload http://localhost:8080:
1. After preloader, 3D tower model should be visible behind the hero text
2. Model should have iridescent/rainbow sheen
3. Scrolling should rotate the model slightly (parallax)
4. No console errors

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: Three.js 3D scene with GLB tower, iridescence material, scroll parallax"
```

---

### Task 6: Constructor Panel — HTML + CSS

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add panel CSS to the `<style>` block**

```css
    /* === Constructor Panel === */
    #constructor-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      background: rgba(10, 10, 10, 0.95);
      backdrop-filter: blur(10px);
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 50;
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }

    #constructor-panel.open {
      transform: translateX(0);
    }

    #panel-toggle {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      z-index: 51;
      width: 40px;
      height: 40px;
      background: rgba(10, 10, 10, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-right: none;
      border-radius: 8px 0 0 8px;
      color: rgb(212, 156, 77);
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: right 0.3s ease;
    }

    #panel-toggle.shifted {
      right: 320px;
    }

    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header span {
      color: rgb(212, 156, 77);
      font-weight: 600;
      font-size: 14px;
    }

    .panel-close {
      color: #666;
      cursor: pointer;
      background: none;
      border: none;
      font-size: 18px;
    }

    .accordion-section {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .accordion-header {
      padding: 12px 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
      font-size: 13px;
      user-select: none;
    }

    .accordion-header:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .accordion-header .label {
      color: #444;
      font-size: 10px;
    }

    .accordion-body {
      padding: 0 20px 16px;
      display: none;
    }

    .accordion-section.open .accordion-body {
      display: block;
    }

    .accordion-section.open .accordion-arrow {
      transform: rotate(90deg);
    }

    .accordion-arrow {
      transition: transform 0.2s;
      font-size: 10px;
      margin-right: 6px;
    }

    /* Control styles */
    .ctrl-group {
      margin-bottom: 12px;
    }

    .ctrl-label {
      display: flex;
      justify-content: space-between;
      color: #888;
      font-size: 10px;
      margin-bottom: 4px;
    }

    .ctrl-value {
      color: rgb(212, 156, 77);
    }

    .ctrl-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 3px;
      background: #222;
      border-radius: 2px;
      outline: none;
    }

    .ctrl-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      background: rgb(212, 156, 77);
      border-radius: 50%;
      cursor: pointer;
    }

    .ctrl-select {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 6px 8px;
      color: #aaa;
      font-size: 11px;
      outline: none;
    }

    .ctrl-textarea {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 6px 8px;
      color: #aaa;
      font-size: 11px;
      outline: none;
      resize: vertical;
      min-height: 40px;
      font-family: inherit;
    }

    .ctrl-input {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 6px 8px;
      color: #aaa;
      font-size: 11px;
      outline: none;
      font-family: inherit;
    }

    .ctrl-color {
      width: 100%;
      height: 30px;
      border: 1px solid #333;
      border-radius: 4px;
      background: none;
      cursor: pointer;
      padding: 2px;
    }

    .ctrl-segmented {
      display: flex;
      gap: 4px;
    }

    .ctrl-seg-btn {
      padding: 2px 8px;
      background: #222;
      border: 1px solid transparent;
      border-radius: 3px;
      font-size: 9px;
      color: #666;
      cursor: pointer;
    }

    .ctrl-seg-btn.active {
      background: rgba(212, 156, 77, 0.2);
      border-color: rgb(212, 156, 77);
      color: rgb(212, 156, 77);
    }

    .ctrl-toggle {
      position: relative;
      width: 36px;
      height: 20px;
      background: #333;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .ctrl-toggle.active {
      background: rgb(212, 156, 77);
    }

    .ctrl-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .ctrl-toggle.active::after {
      transform: translateX(16px);
    }

    .panel-export-btn {
      display: block;
      margin: 16px 20px;
      padding: 10px;
      border: 1px solid rgb(212, 156, 77);
      text-align: center;
      border-radius: 6px;
      color: rgb(212, 156, 77);
      font-size: 13px;
      cursor: pointer;
      background: none;
      transition: background 0.2s;
    }

    .panel-export-btn:hover {
      background: rgba(212, 156, 77, 0.1);
    }

    /* GLB Drop Zone */
    .ctrl-dropzone {
      border: 2px dashed #333;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      color: #555;
      font-size: 10px;
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .ctrl-dropzone.dragover {
      border-color: rgb(212, 156, 77);
      color: rgb(212, 156, 77);
    }
```

- [ ] **Step 2: Add panel HTML after the preloader div (before gl-container)**

Insert after `<div id="preloader">...</div>`:

```html
  <!-- Constructor Panel Toggle -->
  <button id="panel-toggle" onclick="togglePanel()">&#9881;</button>

  <!-- Constructor Panel -->
  <aside id="constructor-panel">
    <div class="panel-header">
      <span>&#9881; Constructor</span>
      <button class="panel-close" onclick="togglePanel()">&times;</button>
    </div>

    <!-- Hero Group -->
    <div class="accordion-section open">
      <div class="accordion-header" onclick="toggleAccordion(this)">
        <span><span class="accordion-arrow">&#9654;</span> Hero</span>
        <span class="label">section 1</span>
      </div>
      <div class="accordion-body">
        <div class="ctrl-group">
          <div class="ctrl-label"><span>H1 Text</span></div>
          <textarea class="ctrl-textarea" id="ctrl-hero-h1-text" rows="2" oninput="updateHeroH1Text(this.value)">Where Others Advise,\nWe Build — With You</textarea>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>H1 Font Size</span><span class="ctrl-value" id="val-hero-h1-size">64px</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-hero-h1-size" min="32" max="96" value="64" oninput="updateHeroH1Size(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Font Weight</span><span class="ctrl-value" id="val-hero-h1-weight">300</span></div>
          <div class="ctrl-segmented" id="ctrl-hero-weight">
            <button class="ctrl-seg-btn" onclick="updateHeroWeight(100)">100</button>
            <button class="ctrl-seg-btn" onclick="updateHeroWeight(200)">200</button>
            <button class="ctrl-seg-btn active" onclick="updateHeroWeight(300)">300</button>
            <button class="ctrl-seg-btn" onclick="updateHeroWeight(400)">400</button>
          </div>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Subtitle Text</span></div>
          <textarea class="ctrl-textarea" id="ctrl-hero-subtitle" rows="2" oninput="updateHeroSubtitle(this.value)">Strategic venture creation that turns bold ideas into market-ready businesses. We embed with founders, validate fast, and build what lasts.</textarea>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>CTA Text</span></div>
          <input type="text" class="ctrl-input" id="ctrl-hero-cta" value="Get in touch" oninput="updateHeroCta(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Preloader</span></div>
          <div class="ctrl-toggle active" id="ctrl-preloader" onclick="togglePreloader(this)"></div>
        </div>
      </div>
    </div>

    <!-- 3D Scene Group -->
    <div class="accordion-section">
      <div class="accordion-header" onclick="toggleAccordion(this)">
        <span><span class="accordion-arrow">&#9654;</span> 3D Scene</span>
        <span class="label">WebGL</span>
      </div>
      <div class="accordion-body">
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Iridescence</span><span class="ctrl-value" id="val-iridescence">1.0</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-iridescence" min="0" max="1" step="0.01" value="1" oninput="updateIridescence(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Iridescence IOR</span><span class="ctrl-value" id="val-ior">1.3</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-ior" min="1.0" max="2.5" step="0.01" value="1.3" oninput="updateIOR(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Parallax Speed</span><span class="ctrl-value" id="val-parallax">0.001</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-parallax" min="0" max="0.005" step="0.0001" value="0.001" oninput="updateParallax(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Camera FOV</span><span class="ctrl-value" id="val-fov">45</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-fov" min="20" max="90" value="45" oninput="updateFOV(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Model Source</span></div>
          <select class="ctrl-select" id="ctrl-model-source" onchange="updateModelSource(this.value)">
            <option value="glb" selected>GLB (tower02)</option>
            <option value="procedural">Procedural geometry</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Custom GLB</span></div>
          <div class="ctrl-dropzone" id="ctrl-glb-drop" ondrop="handleGLBDrop(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
            Drop .glb file here
          </div>
        </div>
      </div>
    </div>

    <!-- Animation Group -->
    <div class="accordion-section">
      <div class="accordion-header" onclick="toggleAccordion(this)">
        <span><span class="accordion-arrow">&#9654;</span> Animation</span>
        <span class="label">GSAP</span>
      </div>
      <div class="accordion-body">
        <div class="ctrl-group">
          <div class="ctrl-label"><span>GSAP Duration</span><span class="ctrl-value" id="val-gsap-duration">0.8s</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-gsap-duration" min="0.3" max="2.0" step="0.1" value="0.8" oninput="updateGSAPDuration(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Ease</span></div>
          <select class="ctrl-select" id="ctrl-gsap-ease" onchange="updateGSAPEase(this.value)">
            <option value="power1.out">power1.out</option>
            <option value="power2.out" selected>power2.out</option>
            <option value="power3.out">power3.out</option>
            <option value="power4.out">power4.out</option>
            <option value="elastic.out(1,0.3)">elastic</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Stagger Delay</span><span class="ctrl-value" id="val-stagger">0.15s</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-stagger" min="0" max="0.5" step="0.01" value="0.15" oninput="updateStagger(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>ScrollTrigger Start</span><span class="ctrl-value" id="val-st-start">top 80%</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-st-start" min="50" max="95" value="80" oninput="updateSTStart(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Fade Y Distance</span><span class="ctrl-value" id="val-fade-y">40px</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-fade-y" min="0" max="100" value="40" oninput="updateFadeY(this.value)">
        </div>
      </div>
    </div>

    <!-- Global Group -->
    <div class="accordion-section">
      <div class="accordion-header" onclick="toggleAccordion(this)">
        <span><span class="accordion-arrow">&#9654;</span> Global</span>
        <span class="label">theme</span>
      </div>
      <div class="accordion-body">
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Lenis Duration</span><span class="ctrl-value" id="val-lenis-dur">1.2</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-lenis-dur" min="0.5" max="3.0" step="0.1" value="1.2" oninput="updateLenisDuration(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Touch Multiplier</span><span class="ctrl-value" id="val-lenis-touch">2</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-lenis-touch" min="1" max="5" step="0.5" value="2" oninput="updateLenisTouch(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Background Color</span></div>
          <input type="color" class="ctrl-color" id="ctrl-bg-color" value="#000000" oninput="updateBgColor(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Accent Color</span></div>
          <input type="color" class="ctrl-color" id="ctrl-accent-color" value="#d49c4d" oninput="updateAccentColor(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Text Color</span></div>
          <input type="color" class="ctrl-color" id="ctrl-text-color" value="#ffffff" oninput="updateTextColor(this.value)">
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label"><span>Base Font Size</span><span class="ctrl-value" id="val-font-size">16px</span></div>
          <input type="range" class="ctrl-slider" id="ctrl-font-size" min="14" max="18" value="16" oninput="updateFontSize(this.value)">
        </div>
      </div>
    </div>

    <!-- Export Button -->
    <button class="panel-export-btn" onclick="openExportModal()">Export Code &#8599;</button>
  </aside>
```

- [ ] **Step 3: Verify panel renders**

Reload — click the gear button on the right edge. Panel should slide in from the right with all 4 accordion sections. Click accordion headers to expand/collapse. Sliders, selects, inputs should render correctly.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: constructor panel HTML + CSS with all controls"
```

---

### Task 7: Constructor Panel — JavaScript Logic

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add panel toggle and accordion logic**

Insert as a `<script>` block before the Lenis init script:

```html
  <!-- === Constructor Panel Logic === -->
  <script>
    // === Panel Toggle ===
    function togglePanel() {
      const panel = document.getElementById('constructor-panel');
      const toggle = document.getElementById('panel-toggle');
      panel.classList.toggle('open');
      toggle.classList.toggle('shifted');
    }

    // === Accordion ===
    function toggleAccordion(header) {
      header.parentElement.classList.toggle('open');
    }

    // === State object for all parameters ===
    const config = {
      hero: {
        h1Text: "Where Others Advise,\nWe Build — With You",
        h1Size: 64,
        h1Weight: 300,
        subtitle: "Strategic venture creation that turns bold ideas into market-ready businesses. We embed with founders, validate fast, and build what lasts.",
        ctaText: "Get in touch",
        preloader: true,
      },
      scene3d: {
        iridescence: 1.0,
        iridescenceIOR: 1.3,
        parallaxSpeed: 0.001,
        fov: 45,
        modelSource: "glb",
      },
      animation: {
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.15,
        stStart: 80,
        fadeY: 40,
      },
      global: {
        lenisDuration: 1.2,
        lenisTouch: 2,
        bgColor: "#000000",
        accentColor: "#d49c4d",
        textColor: "#ffffff",
        fontSize: 16,
      }
    };

    // === Hero Controls ===
    function updateHeroH1Text(val) {
      config.hero.h1Text = val;
      document.getElementById('hero-h1').innerHTML = val.replace(/\n/g, '<br>');
    }

    function updateHeroH1Size(val) {
      config.hero.h1Size = Number(val);
      document.documentElement.style.setProperty('--hero-h1-size', val + 'px');
      document.getElementById('val-hero-h1-size').textContent = val + 'px';
    }

    function updateHeroWeight(val) {
      config.hero.h1Weight = val;
      document.documentElement.style.setProperty('--hero-h1-weight', val);
      document.getElementById('val-hero-h1-weight').textContent = val;
      document.querySelectorAll('#ctrl-hero-weight .ctrl-seg-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.textContent) === val);
      });
    }

    function updateHeroSubtitle(val) {
      config.hero.subtitle = val;
      document.getElementById('hero-subtitle').textContent = val;
    }

    function updateHeroCta(val) {
      config.hero.ctaText = val;
      document.getElementById('hero-cta').textContent = val;
    }

    function togglePreloader(el) {
      el.classList.toggle('active');
      config.hero.preloader = el.classList.contains('active');
    }

    // === 3D Scene Controls ===
    function updateIridescence(val) {
      config.scene3d.iridescence = Number(val);
      document.getElementById('val-iridescence').textContent = Number(val).toFixed(2);
      if (window.scene3d && window.scene3d.material) {
        window.scene3d.material.iridescence = Number(val);
      }
    }

    function updateIOR(val) {
      config.scene3d.iridescenceIOR = Number(val);
      document.getElementById('val-ior').textContent = Number(val).toFixed(2);
      if (window.scene3d && window.scene3d.material) {
        window.scene3d.material.iridescenceIOR = Number(val);
      }
    }

    function updateParallax(val) {
      config.scene3d.parallaxSpeed = Number(val);
      document.getElementById('val-parallax').textContent = Number(val).toFixed(4);
      if (window.scene3d && window.scene3d.setParallaxSpeed) {
        window.scene3d.setParallaxSpeed(Number(val));
      }
    }

    function updateFOV(val) {
      config.scene3d.fov = Number(val);
      document.getElementById('val-fov').textContent = val;
      if (window.scene3d && window.scene3d.camera) {
        window.scene3d.camera.fov = Number(val);
        window.scene3d.camera.updateProjectionMatrix();
      }
    }

    function updateModelSource(val) {
      config.scene3d.modelSource = val;
      // Model switching will be implemented when procedural geometry is added
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.currentTarget.classList.add('dragover');
    }

    function handleDragLeave(e) {
      e.currentTarget.classList.remove('dragover');
    }

    function handleGLBDrop(e) {
      e.preventDefault();
      e.currentTarget.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.glb')) {
        e.currentTarget.textContent = file.name;
        // GLB loading will use the same GLTFLoader from the module script
        // We dispatch a custom event that the module script listens for
        window.dispatchEvent(new CustomEvent('load-custom-glb', { detail: file }));
      }
    }

    // === Animation Controls ===
    function updateGSAPDuration(val) {
      config.animation.duration = Number(val);
      document.getElementById('val-gsap-duration').textContent = val + 's';
    }

    function updateGSAPEase(val) {
      config.animation.ease = val;
    }

    function updateStagger(val) {
      config.animation.stagger = Number(val);
      document.getElementById('val-stagger').textContent = val + 's';
    }

    function updateSTStart(val) {
      config.animation.stStart = Number(val);
      document.getElementById('val-st-start').textContent = 'top ' + val + '%';
    }

    function updateFadeY(val) {
      config.animation.fadeY = Number(val);
      document.getElementById('val-fade-y').textContent = val + 'px';
    }

    // === Global Controls ===
    function updateLenisDuration(val) {
      config.global.lenisDuration = Number(val);
      document.getElementById('val-lenis-dur').textContent = val;
      if (window.lenis) {
        window.lenis.options.duration = Number(val);
      }
    }

    function updateLenisTouch(val) {
      config.global.lenisTouch = Number(val);
      document.getElementById('val-lenis-touch').textContent = val;
      if (window.lenis) {
        window.lenis.options.touchMultiplier = Number(val);
      }
    }

    function updateBgColor(val) {
      config.global.bgColor = val;
      document.documentElement.style.setProperty('--bg-primary', val);
    }

    function updateAccentColor(val) {
      config.global.accentColor = val;
      document.documentElement.style.setProperty('--accent-color', val);
    }

    function updateTextColor(val) {
      config.global.textColor = val;
      document.documentElement.style.setProperty('--text-primary', val);
    }

    function updateFontSize(val) {
      config.global.fontSize = Number(val);
      document.documentElement.style.setProperty('--base-font-size', val + 'px');
      document.getElementById('val-font-size').textContent = val + 'px';
    }
  </script>
```

- [ ] **Step 2: Add custom GLB listener to the Three.js module script**

Inside the Three.js `<script type="module">`, add before the `animate()` call:

```javascript
    // Listen for custom GLB drops
    window.addEventListener('load-custom-glb', (e) => {
      const file = e.detail;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const arrayBuffer = evt.target.result;
        gltfLoader.parse(arrayBuffer, '', (gltf) => {
          // Remove old model
          if (window.scene3d.model) {
            scene.remove(window.scene3d.model);
          }
          const model = gltf.scene;
          model.traverse((child) => {
            if (child.isMesh) {
              const mat = new THREE.MeshPhysicalMaterial({
                color: 0xaaaaaa,
                metalness: 0.5,
                roughness: 0.3,
                iridescence: config.scene3d.iridescence,
                iridescenceIOR: config.scene3d.iridescenceIOR,
                iridescenceThicknessRange: [100, 400],
                envMapIntensity: 1.0,
              });
              child.material = mat;
              window.scene3d.material = mat;
            }
          });
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scl = 3 / maxDim;
          model.scale.setScalar(scl);
          model.position.sub(center.multiplyScalar(scl));
          scene.add(model);
          window.scene3d.model = model;
        });
      };
      reader.readAsArrayBuffer(file);
    });
```

Note: reference `config` from the global scope — it's defined in the non-module script and accessible as `window.config` implicitly.

- [ ] **Step 3: Verify panel controls work**

Reload http://localhost:8080:
1. Open panel — toggle gear button
2. Change H1 size slider — text resizes in real time
3. Change font weight — segmented button updates
4. Change iridescence slider — 3D material updates
5. Change FOV — camera perspective shifts
6. Change parallax speed — scroll parallax faster/slower
7. Change background color — page background updates
8. Change Lenis duration — scroll feel changes

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: constructor panel JS logic - all controls wired to live preview"
```

---

### Task 8: Export System

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add export modal CSS**

Add to `<style>`:

```css
    /* === Export Modal === */
    #export-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(5px);
      align-items: center;
      justify-content: center;
    }

    #export-modal.open {
      display: flex;
    }

    .export-content {
      background: #111;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      width: 90%;
      max-width: 700px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .export-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .export-header h3 {
      color: #fff;
      font-size: 16px;
      font-weight: 400;
    }

    .export-tabs {
      display: flex;
      border-bottom: 1px solid #333;
    }

    .export-tab {
      padding: 10px 20px;
      color: #666;
      font-size: 12px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      background: none;
      border-top: none;
      border-left: none;
      border-right: none;
    }

    .export-tab.active {
      color: rgb(212, 156, 77);
      border-bottom-color: rgb(212, 156, 77);
    }

    .export-code {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .export-code pre {
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 6px;
      padding: 16px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 11px;
      color: #aaa;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      overflow: auto;
      max-height: 50vh;
    }

    .export-actions {
      padding: 12px 16px;
      border-top: 1px solid #222;
      display: flex;
      gap: 8px;
    }

    .export-copy {
      flex: 1;
      padding: 10px;
      background: rgb(212, 156, 77);
      color: #000;
      text-align: center;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }

    .export-download {
      padding: 10px 20px;
      border: 1px solid #333;
      color: #aaa;
      text-align: center;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      background: none;
    }
```

- [ ] **Step 2: Add export modal HTML before closing `</body>`**

```html
  <!-- Export Modal -->
  <div id="export-modal">
    <div class="export-content">
      <div class="export-header">
        <h3>Export Code</h3>
        <button class="panel-close" onclick="closeExportModal()">&times;</button>
      </div>
      <div class="export-tabs">
        <button class="export-tab active" onclick="switchExportTab('single', this)">Single File</button>
        <button class="export-tab" onclick="switchExportTab('separated', this)">Separated</button>
        <button class="export-tab" onclick="switchExportTab('config', this)">Config JSON</button>
      </div>
      <div class="export-code">
        <pre id="export-output"></pre>
      </div>
      <div class="export-actions">
        <button class="export-copy" onclick="copyExport()">Copy to Clipboard</button>
        <button class="export-download" onclick="downloadExport()">Download</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Add export JS logic**

Add to the Constructor Panel Logic `<script>` block:

```javascript
    // === Export System ===
    let currentExportTab = 'single';
    let currentExportContent = '';

    function openExportModal() {
      document.getElementById('export-modal').classList.add('open');
      generateExport('single');
    }

    function closeExportModal() {
      document.getElementById('export-modal').classList.remove('open');
    }

    function switchExportTab(tab, btn) {
      currentExportTab = tab;
      document.querySelectorAll('.export-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      generateExport(tab);
    }

    function generateExport(tab) {
      const output = document.getElementById('export-output');
      if (tab === 'single') {
        currentExportContent = generateSingleFile();
      } else if (tab === 'separated') {
        currentExportContent = generateSeparated();
      } else {
        currentExportContent = generateConfigJSON();
      }
      output.textContent = currentExportContent;
    }

    function generateSingleFile() {
      return `<!-- Hero Block — exported from hypercube -->
<!-- Config: ${JSON.stringify(config.hero)} -->
<style>
  .hero-block {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: ${config.global.bgColor};
    color: ${config.global.textColor};
    font-family: 'mosvita', 'Inter', Arial, sans-serif;
    font-size: ${config.global.fontSize}px;
    position: relative;
    padding: 160px 48px 80px;
  }
  .hero-block h1 {
    font-size: ${config.hero.h1Size}px;
    font-weight: ${config.hero.h1Weight};
    line-height: 1;
    margin-bottom: 24px;
  }
  .hero-block p {
    color: rgb(187, 187, 187);
    max-width: 520px;
    margin-bottom: 32px;
    line-height: 1.5;
  }
  .hero-block .cta {
    display: inline-block;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 9999px;
    padding: 12px 32px;
    color: ${config.global.textColor};
    text-decoration: none;
    transition: background 0.2s;
  }
  .hero-block .cta:hover { background: rgba(255,255,255,0.1); }
</style>

<section class="hero-block">
  <h1>${config.hero.h1Text.replace(/\n/g, '<br>')}</h1>
  <p>${config.hero.subtitle}</p>
  <a href="#contact" class="cta">${config.hero.ctaText}</a>
</section>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"><\/script>
<script>
  gsap.from(".hero-block h1", { opacity: 0, y: ${config.animation.fadeY}, duration: ${config.animation.duration}, ease: "${config.animation.ease}" });
  gsap.from(".hero-block p", { opacity: 0, y: ${config.animation.fadeY}, duration: ${config.animation.duration}, ease: "${config.animation.ease}", delay: ${config.animation.stagger} });
  gsap.from(".hero-block .cta", { opacity: 0, y: ${config.animation.fadeY}, duration: ${config.animation.duration}, ease: "${config.animation.ease}", delay: ${config.animation.stagger * 2} });
<\/script>`;
    }

    function generateSeparated() {
      return `=== HTML ===
<section class="hero-block">
  <h1>${config.hero.h1Text.replace(/\n/g, '<br>')}</h1>
  <p>${config.hero.subtitle}</p>
  <a href="#contact" class="cta">${config.hero.ctaText}</a>
</section>

=== CSS ===
.hero-block {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: ${config.global.bgColor};
  color: ${config.global.textColor};
  font-family: 'mosvita', 'Inter', Arial, sans-serif;
  font-size: ${config.global.fontSize}px;
  position: relative;
  padding: 160px 48px 80px;
}
.hero-block h1 {
  font-size: ${config.hero.h1Size}px;
  font-weight: ${config.hero.h1Weight};
  line-height: 1;
  margin-bottom: 24px;
}
.hero-block p {
  color: rgb(187, 187, 187);
  max-width: 520px;
  margin-bottom: 32px;
  line-height: 1.5;
}
.hero-block .cta {
  display: inline-block;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 9999px;
  padding: 12px 32px;
  color: ${config.global.textColor};
  text-decoration: none;
  transition: background 0.2s;
}
.hero-block .cta:hover { background: rgba(255,255,255,0.1); }

=== JS ===
gsap.from(".hero-block h1", { opacity: 0, y: ${config.animation.fadeY}, duration: ${config.animation.duration}, ease: "${config.animation.ease}" });
gsap.from(".hero-block p", { opacity: 0, y: ${config.animation.fadeY}, duration: ${config.animation.duration}, ease: "${config.animation.ease}", delay: ${config.animation.stagger} });
gsap.from(".hero-block .cta", { opacity: 0, y: ${config.animation.fadeY}, duration: ${config.animation.duration}, ease: "${config.animation.ease}", delay: ${config.animation.stagger * 2} });`;
    }

    function generateConfigJSON() {
      return JSON.stringify(config, null, 2);
    }

    function copyExport() {
      navigator.clipboard.writeText(currentExportContent).then(() => {
        const btn = document.querySelector('.export-copy');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 2000);
      });
    }

    function downloadExport() {
      let ext = 'html';
      let mime = 'text/html';
      if (currentExportTab === 'config') { ext = 'json'; mime = 'application/json'; }
      const blob = new Blob([currentExportContent], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `hero-block.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    // Close modal on backdrop click
    document.getElementById('export-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeExportModal();
    });
```

- [ ] **Step 4: Verify export works**

1. Open panel → click "Export Code"
2. Modal opens with Single File tab showing full HTML+CSS+JS
3. Switch to Separated — shows 3 sections
4. Switch to Config JSON — shows JSON with all current values
5. Change a slider (e.g., H1 size to 48px), reopen export — values reflect change
6. Click "Copy to Clipboard" — button shows "Copied!"
7. Click "Download" — .html file downloads

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: export system with 3 tabs — single file, separated, config JSON"
```

---

### Task 9: Final Polish + Remove Scroll Spacer

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove the scroll spacer**

Delete the `<div id="scroll-spacer">` section that was added in Task 4 for testing.

- [ ] **Step 2: Add Lenis `data-lenis-prevent` to the constructor panel**

On `<aside id="constructor-panel">`, add `data-lenis-prevent` so Lenis doesn't intercept scroll inside the panel:

```html
<aside id="constructor-panel" data-lenis-prevent>
```

- [ ] **Step 3: Add `data-lenis-prevent` to the export modal**

```html
<div id="export-modal" data-lenis-prevent>
```

- [ ] **Step 4: Verify final state**

Reload http://localhost:8080:
1. Preloader → hero fade-in → smooth scroll all work
2. 3D tower renders with iridescence
3. Header blurs on scroll
4. Panel opens/closes, all sliders work
5. Panel scrolls independently from page (Lenis doesn't hijack it)
6. Export generates correct code
7. No console errors

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: iteration 1 complete — hero + 3D + constructor + export"
```

---

## Self-Review Checklist

- **Spec coverage:** All 5 components from Iteration 1 spec are implemented (Header, Hero, 3D Scene, Lenis+GSAP, Constructor Panel). Export system with 3 tabs covered. All constructor parameters from spec tables are present.
- **Placeholder scan:** No TBD/TODO — all code blocks are complete. Model source switching to procedural is stubbed with a comment (intentional — spec says "architecturally: support" not "implement now"). Custom GLB drop handler is fully implemented.
- **Type consistency:** `config` object keys match throughout — `config.hero.h1Size` used in both controls and export. `window.scene3d` interface consistent between module script and panel logic. Function names in HTML `oninput`/`onclick` match JS definitions.
