# hypercube Block Constructor — Design Spec

## Vision

Публичный веб-инструмент для изучения и настройки анимационных паттернов. Позволяет дизайнерам и разработчикам изучать, настраивать и экспортировать готовые анимированные блоки. Сценарий: дизайнер придумал анимацию → настроил в конструкторе → экспортировал код → передал в разработку.

## Target

Веб-приложение на домене (статика, без бэкенда).

## Tech Stack

| Library | Version | Role |
|---------|---------|------|
| GSAP | 3.13.0 | Все анимации |
| ScrollTrigger | GSAP plugin | Scroll-driven анимации |
| Lenis | 1.0.42 | Smooth scroll + инерция |
| Three.js | r172 | 3D WebGL сцена |
| Tailwind CSS | CDN latest | Утилитарные стили |

## Architecture

### Approach: Monolithic Single File → Module Refactor

**Фаза 1 (итерации 1–3):** Один `index.html` — CSS в `<style>`, секции в `<body>`, JS в `<script>`. Чистая структура без абстракций, фокус на понимании каждого блока.

**Фаза 2 (после 3–4 блоков):** Рефакторинг в модульную структуру — классы `BlockHero`, `BlockWhyNow` и т.д., центральный `BlockRegistry`, изолированный экспорт.

### File Structure (Phase 1)

```
/
├── index.html              ← single file, всё внутри
├── assets/   ← ассеты (уже скачаны)
│   ├── tower02.glb
│   ├── env.jpg
│   ├── iridescence.png
│   ├── mosvita.woff2
│   ├── logo0–9.jpg
│   ├── *.svg
│   └── ...
└── docs/
```

### index.html Internal Structure

```
CDN scripts (GSAP, Lenis, Three.js, Tailwind)
<style>
  @font-face mosvita
  CSS custom properties (design tokens)
  Layout styles
  Constructor panel styles
</style>
<body>
  <aside id="panel">         — выдвижная панель конструктора (320px, справа)
  <div class="gl-container">  — фиксированный WebGL canvas (z-index: -1)
  <header>                    — fixed навигация
  <section id="hero">         — итерация 1
  <section id="why-you-matter"> — итерация 2
  ...8 секций total...
  <footer>
  <div id="export-modal">     — модальное окно экспорта
<script> Lenis init + GSAP sync </script>
<script> Three.js scene </script>
<script> Section animations </script>
<script> Constructor panel logic </script>
<script> Export functions </script>
</body>
```

## Design System (from original)

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-black` | `#000000` | Основной фон |
| `--bg-white` | `#ffffff` | Секция Contact |
| `--text-white` | `rgb(255,255,255)` | Основной текст на чёрном |
| `--text-gray-1` | `rgb(187,187,187)` | Вторичный текст |
| `--text-gray-2` | `rgb(165,165,165)` | Третичный текст |
| `--text-gold` | `rgb(212,156,77)` | Акцент (логотип, highlights, UI конструктора) |
| `--text-dark-1` | `rgb(17,17,17)` | Текст на белом фоне |
| `--border-white-10` | `rgba(255,255,255,0.1)` | Тонкие границы |

### Typography

- Primary font: mosvita (custom, файл в ассетах). Fallback: Inter 300 / Arial.
- H1: 64px / weight 300 / line-height 1.0
- H2: 36px desktop, 26px mobile / weight 300 / line-height 1.2
- Body: 16px / weight 400 / line-height 1.5

## Iteration 1: Hero + 3D + Constructor Panel

### Components

**1. Header (fixed)**
- Логотип SVG (gold) слева, навигация справа
- При скролле >80px: `backdrop-filter: blur(5px)` + `bg-black/90`
- ScrollTrigger для отслеживания позиции

**2. Hero Section**
- H1: "Where Others Advise, We Build — With You"
- Подзаголовок + CTA кнопка "Get in touch" (border, rounded)
- Лейбл: "Venture Studio | Disruptive Agency"
- Preloader counter: 0% → 100% (GSAP innerHTML tween, power2.inOut)
- Fade-in анимация при загрузке

**3. 3D WebGL Scene**
- Canvas фиксирован (`position: fixed; z-index: -1`)
- Three.js WebGLRenderer с `antialias: true, alpha: true`
- Pixel ratio: `Math.min(devicePixelRatio, 2)`
- GLB модель tower02 с MeshPhysicalMaterial:
  - `iridescence: 1.0`
  - `iridescenceIOR: 1.3`
  - `iridescenceThicknessRange: [100, 400]`
  - envMap из env.jpg
- Параллакс: `scene.rotation.y = lenis.scroll * 0.001`
- Архитектурно: поддержка замены на процедурную геометрию или drag-n-drop GLB

**4. Lenis + GSAP**
- Lenis init: `duration: 1.2`, easing: `Math.min(1, 1.001 - Math.pow(2, -10 * e))`, `touchMultiplier: 2`
- Sync: `lenis.on("scroll", ScrollTrigger.update)`
- GSAP ticker: `gsap.ticker.add((t) => lenis.raf(t * 1000))`
- `gsap.ticker.lagSmoothing(0)`

**5. Constructor Panel**
- Drawer справа, 320px ширина, toggle кнопка (⚙)
- Accordion-секции: Hero / 3D Scene / Animation / Global
- Параметры обновляют CSS-переменные и JS в реальном времени

### Constructor Parameters (Iteration 1)

**Hero group:**
| Parameter | Control | Range | Default |
|-----------|---------|-------|---------|
| H1 text | textarea | — | "Where Others Advise..." |
| H1 size | slider | 32–96px | 64px |
| Font weight | segmented | 100/200/300/400 | 300 |
| Subtitle text | textarea | — | original text |
| CTA text | input | — | "Get in touch" |
| Preloader | toggle | on/off | on |

**3D Scene group:**
| Parameter | Control | Range | Default |
|-----------|---------|-------|---------|
| Iridescence | slider | 0–1 | 1.0 |
| Iridescence IOR | slider | 1.0–2.5 | 1.3 |
| Parallax speed | slider | 0–0.005 | 0.001 |
| Camera FOV | slider | 20–90 | 45 |
| Model source | select | GLB / procedural | GLB |
| Custom GLB | drop zone | — | — |

**Animation group:**
| Parameter | Control | Range | Default |
|-----------|---------|-------|---------|
| GSAP duration | slider | 0.3–2.0s | 0.8s |
| Ease | select | power1–4, elastic | power2.out |
| Stagger delay | slider | 0–0.5s | 0.15s |
| ScrollTrigger start | slider | top 50–95% | top 80% |
| Fade Y distance | slider | 0–100px | 40px |

**Global group:**
| Parameter | Control | Range | Default |
|-----------|---------|-------|---------|
| Lenis duration | slider | 0.5–3.0 | 1.2 |
| Lenis touch multiplier | slider | 1–5 | 2 |
| Background color | picker | — | #000000 |
| Accent color | picker | — | rgb(212,156,77) |
| Text color | picker | — | #ffffff |
| Base font size | slider | 14–18px | 16px |

## Export System

### Export Modal — 3 tabs

**Tab 1: Single File**
- Самодостаточный HTML+CSS+JS сниппет блока
- Включает inline стили, HTML разметку, JS для анимаций
- Комментарий с параметрами конструктора
- Copy to clipboard + Download .html

**Tab 2: Separated**
- HTML, CSS, JS в отдельных блоках с переключением
- Copy each / Download as .zip (future)

**Tab 3: Config JSON**
- JSON с текущими значениями всех параметров
- Можно импортировать обратно в конструктор
- Формат: `{ "hero": { "h1Size": 64, ... }, "scene3d": { ... }, ... }`

## Iteration Plan (subsequent)

| # | Section | Key Elements |
|---|---------|-------------|
| 2 | Why You Matter | H2 + bullet list, fade-in анимации |
| 3 | Why Now | Цитаты, bold акцент, staggered reveal |
| 4 | What We Do | 2×2 карточки с SVG, stagger animation |
| 5 | How We Work | 3 колонки, fade-in |
| 6 | Client Partners | Logo carousel (Swiper/custom) |
| 7 | Where We Are | fadeToBlack scrub, live clocks |
| 8 | Contact | Белая секция, форма, инверсия цветов |
| — | Footer | Навигация + соцсети |
| — | Refactor | Модульная архитектура (Phase 2) |

## Assets (already downloaded)

All in `assets/`:
- `tower02.glb` — 3D модель башни
- `env.jpg` — environment map
- `iridescence.png`, `sphere-normal.jpg`, `LDR_RG01_0*.png` — текстуры
- `mosvita.woff2`, `mosvita.ttf` — кастомный шрифт
- `logo0.jpg` – `logo9.jpg` — логотипы клиентов
- `venture-creation.svg`, `rocket.svg`, `handshake.svg`, `ai.svg` — иконки секций
- `logo.svg` — логотип
- `glimpse.png`, `pitch.png`, `due-dill.png` — доп. иконки
