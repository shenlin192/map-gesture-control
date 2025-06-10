# Map Gesture Control

A real-time hand gesture-controlled map interface using computer vision.

## Core tech stack

- React
- TypeScript
- Vite
- MapLibre GL JS
- MediaPipe Tasks Vision
- Tailwind CSS

## Gesture Controls

### Pan Mode
- **Gesture**: Index finger pointing up (other fingers curled)
- **Action**: Move the map by pointing your index finger in the desired direction
- **Dead Zone**: Small center area where no movement occurs for stability

### Zoom In
- **Gesture**: Victory sign (index and middle fingers extended, others curled)
- **Action**: Zoom into the map
- **Speed**: Distance from center controls zoom speed

### Zoom Out
- **Gesture**: Pinch (thumb and index finger close together, others curled)
- **Action**: Zoom out of the map
- **Speed**: Distance from center controls zoom speed

### Idle
- **Gesture**: Closed fist or open palm
- **Action**: No map control, hand tracking paused
