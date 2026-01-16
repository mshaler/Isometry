#!/bin/bash

# ============================================================================
# Isometry Project Setup Script
# ============================================================================
# This script sets up the complete Isometry project structure from the
# Figma handoff package. Run from anywhere - it will create/update the
# project at the specified location.
#
# Usage:
#   ./setup-isometry-project.sh [project-path]
#
# Default project path: ~/Developer/Projects/Isometry
# ============================================================================

set -e

# Configuration
DEFAULT_PROJECT_PATH="$HOME/Developer/Projects/Isometry"
PROJECT_PATH="${1:-$DEFAULT_PROJECT_PATH}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HANDOFF_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  Isometry Project Setup${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "Project path: ${GREEN}$PROJECT_PATH${NC}"
echo -e "Handoff source: ${GREEN}$HANDOFF_DIR${NC}"
echo ""

# Confirm with user
read -p "Proceed with setup? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Step 1: Creating project directory structure...${NC}"

# Create directory structure
mkdir -p "$PROJECT_PATH"/{src/{components/ui,contexts,hooks,dsl,db,lib},docs,design/isometry-ui-handoff,specs/dsl,public/assets,tests}

echo "  ✓ Created src/"
echo "  ✓ Created docs/"
echo "  ✓ Created design/"
echo "  ✓ Created specs/"
echo "  ✓ Created tests/"

echo ""
echo -e "${YELLOW}Step 2: Copying Figma handoff files...${NC}"

# Copy design handoff
cp -r "$HANDOFF_DIR/components" "$PROJECT_PATH/design/isometry-ui-handoff/"
cp -r "$HANDOFF_DIR/contexts" "$PROJECT_PATH/design/isometry-ui-handoff/"
cp -r "$HANDOFF_DIR/scripts" "$PROJECT_PATH/design/isometry-ui-handoff/"
cp "$HANDOFF_DIR/FIGMA-HANDOFF.md" "$PROJECT_PATH/design/isometry-ui-handoff/"
cp "$HANDOFF_DIR/App.tsx" "$PROJECT_PATH/design/isometry-ui-handoff/"

echo "  ✓ Copied components/"
echo "  ✓ Copied contexts/"
echo "  ✓ Copied scripts/"
echo "  ✓ Copied FIGMA-HANDOFF.md"

echo ""
echo -e "${YELLOW}Step 3: Setting up documentation...${NC}"

# Copy docs
if [ -d "$HANDOFF_DIR/docs" ]; then
    cp -r "$HANDOFF_DIR/docs"/* "$PROJECT_PATH/docs/"
    echo "  ✓ Copied architecture docs"
fi

# Copy CLAUDE.md to project root
cp "$HANDOFF_DIR/CLAUDE.md" "$PROJECT_PATH/CLAUDE.md"
echo "  ✓ Installed CLAUDE.md (Claude Code project context)"

echo ""
echo -e "${YELLOW}Step 4: Creating source file templates...${NC}"

# Create ThemeContext in src
cat > "$PROJECT_PATH/src/contexts/ThemeContext.tsx" << 'EOF'
import { createContext, useContext, useState, ReactNode } from 'react';

type Theme = 'NeXTSTEP' | 'Modern';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('NeXTSTEP');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
EOF
echo "  ✓ Created src/contexts/ThemeContext.tsx"

# Create useSQLiteQuery hook template
cat > "$PROJECT_PATH/src/hooks/useSQLiteQuery.ts" << 'EOF'
import { useState, useEffect } from 'react';

interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for executing SQLite queries with loading/error states
 * 
 * Usage:
 *   const { data, loading, error } = useSQLiteQuery<Card>(
 *     'SELECT * FROM cards WHERE status = ?',
 *     ['active']
 *   );
 */
export function useSQLiteQuery<T>(
  sql: string,
  params: any[] = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function executeQuery() {
      setState(prev => ({ ...prev, loading: true }));
      
      try {
        // TODO: Replace with actual SQLite execution
        // const db = await getDatabase();
        // const result = await db.exec(sql, params);
        
        // Placeholder for development
        console.log('SQLite Query:', sql, params);
        const result: T[] = [];
        
        if (!cancelled) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      }
    }

    executeQuery();

    return () => {
      cancelled = true;
    };
  }, [sql, JSON.stringify(params)]);

  return state;
}
EOF
echo "  ✓ Created src/hooks/useSQLiteQuery.ts"

# Create Skeleton UI component
cat > "$PROJECT_PATH/src/components/ui/Skeleton.tsx" << 'EOF'
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  const { theme } = useTheme();
  
  return (
    <div
      className={`animate-pulse ${
        theme === 'NeXTSTEP'
          ? 'bg-[#a0a0a0]'
          : 'bg-gray-200 rounded'
      } ${className}`}
    />
  );
}
EOF
echo "  ✓ Created src/components/ui/Skeleton.tsx"

# Create EmptyState UI component
cat > "$PROJECT_PATH/src/components/ui/EmptyState.tsx" << 'EOF'
import { useTheme } from '../../contexts/ThemeContext';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();
  
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Icon className={`w-12 h-12 mb-4 ${
        theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'
      }`} />
      <p className={`text-lg font-medium mb-1 ${
        theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'
      }`}>
        {title}
      </p>
      {description && (
        <p className={`text-sm mb-4 ${
          theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
        }`}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`px-4 py-2 text-sm ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
              : 'bg-blue-500 text-white rounded-lg hover:bg-blue-600'
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
EOF
echo "  ✓ Created src/components/ui/EmptyState.tsx"

# Create ErrorBoundary component
cat > "$PROJECT_PATH/src/components/ui/ErrorBoundary.tsx" << 'EOF'
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <p className="text-red-500 font-medium">Something went wrong</p>
          <p className="text-sm text-gray-500 mt-1">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
EOF
echo "  ✓ Created src/components/ui/ErrorBoundary.tsx"

echo ""
echo -e "${YELLOW}Step 5: Creating configuration files...${NC}"

# Create package.json
cat > "$PROJECT_PATH/package.json" << 'EOF'
{
  "name": "isometry",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "react-dnd": "^16.0.1",
    "react-dnd-html5-backend": "^16.0.1",
    "d3": "^7.8.5",
    "sql.js": "^1.9.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@playwright/test": "^1.40.0",
    "eslint": "^8.54.0"
  }
}
EOF
echo "  ✓ Created package.json"

# Create tsconfig.json
cat > "$PROJECT_PATH/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF
echo "  ✓ Created tsconfig.json"

# Create tsconfig.node.json
cat > "$PROJECT_PATH/tsconfig.node.json" << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF
echo "  ✓ Created tsconfig.node.json"

# Create vite.config.ts
cat > "$PROJECT_PATH/vite.config.ts" << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
EOF
echo "  ✓ Created vite.config.ts"

# Create tailwind.config.js
cat > "$PROJECT_PATH/tailwind.config.js" << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nextstep: {
          bg: '#c0c0c0',
          raised: '#d4d4d4',
          sunken: '#a0a0a0',
          border: {
            light: '#e8e8e8',
            dark: '#505050',
            mid: '#808080',
          },
          text: {
            primary: '#000000',
            secondary: '#404040',
            muted: '#606060',
          }
        }
      }
    }
  },
  plugins: [],
}
EOF
echo "  ✓ Created tailwind.config.js"

# Create postcss.config.js
cat > "$PROJECT_PATH/postcss.config.js" << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
echo "  ✓ Created postcss.config.js"

# Create index.html
cat > "$PROJECT_PATH/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/isometry.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Isometry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF
echo "  ✓ Created index.html"

# Create main.tsx
cat > "$PROJECT_PATH/src/main.tsx" << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
echo "  ✓ Created src/main.tsx"

# Create index.css
cat > "$PROJECT_PATH/src/index.css" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* NeXTSTEP-style focus outlines */
.nextstep-focus:focus {
  outline: 2px solid #000000;
  outline-offset: 1px;
}

/* Smooth transitions for theme switching */
* {
  transition-property: background-color, border-color, color;
  transition-duration: 150ms;
  transition-timing-function: ease-in-out;
}
EOF
echo "  ✓ Created src/index.css"

# Create placeholder App.tsx
cat > "$PROJECT_PATH/src/App.tsx" << 'EOF'
import { ThemeProvider } from './contexts/ThemeContext';

// TODO: Import components from design/isometry-ui-handoff/components
// and integrate them here

function App() {
  return (
    <ThemeProvider>
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Isometry</h1>
          <p className="text-gray-600 mb-2">Project setup complete!</p>
          <p className="text-sm text-gray-500">
            See design/isometry-ui-handoff/FIGMA-HANDOFF.md for next steps
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
EOF
echo "  ✓ Created src/App.tsx (placeholder)"

# Create .gitignore
cat > "$PROJECT_PATH/.gitignore" << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
dist-ssr/
*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
playwright-report/
test-results/

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
EOF
echo "  ✓ Created .gitignore"

# Create README
cat > "$PROJECT_PATH/README.md" << 'EOF'
# Isometry

A polymorphic data visualization platform implementing the PAFV framework with LATCH filtering and GRAPH operations.

## Quick Start

```bash
npm install
npm run dev
```

## Architecture

See `CLAUDE.md` for project guidelines and `docs/` for architecture documentation.

## Development

- **Figma Handoff**: `design/isometry-ui-handoff/FIGMA-HANDOFF.md`
- **Architecture**: `docs/cardboard-architecture-truth.md`
- **D3 Patterns**: `docs/D3JS-SKILL.md`

## Tech Stack

- **Data**: SQLite + sql.js
- **Visualization**: D3.js
- **UI Chrome**: React + Tailwind
- **Drag-Drop**: react-dnd

---

*The boring stack wins.*
EOF
echo "  ✓ Created README.md"

echo ""
echo -e "${YELLOW}Step 6: Making scripts executable...${NC}"

chmod +x "$PROJECT_PATH/design/isometry-ui-handoff/scripts/"*.sh
echo "  ✓ Made scripts executable"

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "Project created at: ${BLUE}$PROJECT_PATH${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Navigate to project:"
echo -e "     ${BLUE}cd $PROJECT_PATH${NC}"
echo ""
echo "  2. Install dependencies:"
echo -e "     ${BLUE}npm install${NC}"
echo ""
echo "  3. Create GitHub issues (optional):"
echo -e "     ${BLUE}./design/isometry-ui-handoff/scripts/create-figma-handoff-issues.sh${NC}"
echo ""
echo "  4. Start Claude Code:"
echo -e "     ${BLUE}claude${NC}"
echo ""
echo "  5. First prompt for Claude Code:"
echo -e "     ${BLUE}\"Read design/isometry-ui-handoff/FIGMA-HANDOFF.md and start Phase 1\"${NC}"
echo ""
echo -e "${YELLOW}Project structure:${NC}"
echo ""
echo "  $PROJECT_PATH/"
echo "  ├── CLAUDE.md              # Claude Code context (auto-read)"
echo "  ├── README.md"
echo "  ├── package.json"
echo "  ├── src/"
echo "  │   ├── components/ui/     # Skeleton, EmptyState, ErrorBoundary"
echo "  │   ├── contexts/          # ThemeContext"
echo "  │   └── hooks/             # useSQLiteQuery"
echo "  ├── docs/"
echo "  │   ├── cardboard-architecture-truth.md"
echo "  │   └── D3JS-SKILL.md"
echo "  └── design/isometry-ui-handoff/"
echo "      ├── FIGMA-HANDOFF.md   # Integration guide"
echo "      ├── components/        # 9 Figma TSX files"
echo "      └── scripts/           # GitHub issue creator"
echo ""
