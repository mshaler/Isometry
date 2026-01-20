# Isometry Icon Component

Interactive 3D icon component for Isometry, featuring hover-to-spin animation with spring physics.

## Features

- **3D Three.js rendering** for sizes ≥32px
- **2D SVG fallback** for sizes <32px (crisp at small sizes, better performance)
- **Spring physics** for natural bounce when returning to rest
- **Three spin behaviors**: continuous, single rotation, or momentum impulse
- **Configurable glow effect** with customizable color and intensity
- **Keyboard accessible** (Enter/Space to activate)
- **Touch support** for mobile

## Installation

```bash
# Dependencies
npm install three
npm install -D @types/three
```

Copy the `src/` folder contents into your project.

## Usage

### Basic Icon (Menu Anchor)

```tsx
import { IsometryIcon } from './IsometryIcon';

function AppMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <IsometryIcon 
      size={40} 
      onClick={() => setMenuOpen(!menuOpen)}
    />
  );
}
```

### With Custom Spin Behavior

```tsx
// Continuous spin while hovered (default)
<IsometryIcon size={48} spinBehavior="continuous" />

// Single 360° rotation per hover
<IsometryIcon size={48} spinBehavior="single" />

// Momentum impulse that decays
<IsometryIcon size={48} spinBehavior="momentum" />
```

### With Custom Glow

```tsx
<IsometryIcon 
  size={64} 
  glowColor="#10b981"  // Emerald green
  glowIntensity={0.8}  // 0-1 scale
/>
```

### Full-Screen Hero (Splash/About Page)

```tsx
import { IsometryHero } from './IsometryHero';

function AboutPage() {
  return <IsometryHero />;
}
```

## Props

### IsometryIcon

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `48` | Icon size in pixels |
| `className` | `string` | `''` | Additional CSS classes |
| `onClick` | `() => void` | - | Click handler |
| `spinBehavior` | `'continuous' \| 'single' \| 'momentum'` | `'continuous'` | Hover animation style |
| `glowColor` | `string` | `'#4a9eff'` | Glow color (CSS color) |
| `glowIntensity` | `number` | `0.6` | Glow intensity (0-1) |

### Size Recommendations

| Context | Recommended Size | Rendering |
|---------|------------------|-----------|
| Toolbar icon | 16-24px | 2D SVG |
| Menu anchor | 32-48px | 3D |
| Card/tile icon | 48-64px | 3D |
| Hero/splash | Full screen | IsometryHero |

## File Structure

```
src/
├── index.ts           # Exports
├── types.ts           # TypeScript interfaces
├── IsometryIcon.tsx   # Main component (auto-switches 2D/3D)
├── IsometryIcon2D.tsx # SVG fallback for small sizes
└── IsometryHero.tsx   # Full-screen interactive version
```

## Architecture Connection

The 3×3×3 lattice cube visualizes Isometry's PAFV framework:
- **Grid structure** = Planes (x/y/z spatial projection)
- **Intersection points** = Values (Cards)
- **Viewable from any angle** = Polymorphic views

## Customization

### Changing the Grid Size

In `IsometryIcon.tsx`, modify:

```tsx
const gridSize = 3;  // 3×3×3 grid
const cubeSize = 2;  // Overall cube size
const beamRadius = 0.07;  // Beam thickness
```

### Changing the Material

```tsx
const beamMaterial = new THREE.MeshStandardMaterial({
  color: 0xe8e8e8,   // Beam color
  metalness: 0.1,    // 0 = matte, 1 = metallic
  roughness: 0.4,    // 0 = glossy, 1 = rough
});
```

### Changing Spring Physics

In the `springConfig`:

```tsx
const springConfig = {
  stiffness: 180,  // Higher = snappier
  damping: 12,     // Higher = less bounce
  mass: 1,         // Higher = more momentum
};
```

## Performance Notes

- The 2D SVG fallback automatically activates below 32px
- `powerPreference: 'low-power'` is used for icons ≤64px
- Each icon instance has its own WebGL context; avoid rendering many simultaneously
- For lists with many icons, consider using the 2D version exclusively

## License

Part of the Isometry project.
