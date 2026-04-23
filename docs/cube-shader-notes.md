# Infinite Cube Shader — Implementation Notes

## Algorithm Summary
- BoxGeometry(1.05) as bounding hull
- Fragment shader raymarches a rounded-box SDF (size=0.45, radius=0.05)
- Refracted ray tiles infinitely through a grid
- Each grid edge glows with pow(0.64, distance) falloff
- complexity=0: flat glow, complexity=1: shaped glow profile
- 5-sample AA using camera right/up jitter
- Fake rectangular area light via lightMatrix

## Key Uniforms
- cam, camX, camY: camera vectors in object space
- eta: 1.75 (glass IOR)
- glow: 0.64
- glowWidth: 0.025
- lightColor: #d49c4d
- complexity: 1.0
- envIntensity: 3.0

## Per-frame JS update
Transform camera pos/axes into object space via inverse quaternion + scale division.
