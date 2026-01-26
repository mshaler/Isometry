# Technology Stack

**Analysis Date:** 2026-01-25

## Languages

**Primary:**
- TypeScript 5.2.2 - React frontend development
- Swift 5.9+ - Native iOS/macOS application

**Secondary:**
- JavaScript (ES2020) - Build tooling and server scripts
- SQL - Database schema and queries

## Runtime

**Environment:**
- Node.js (ES2020 target)
- Swift runtime (iOS 17+, macOS 14+)

**Package Manager:**
- npm (with package-lock.json)
- Swift Package Manager

## Frameworks

**Core:**
- React 18.2.0 - Frontend UI framework
- SwiftUI - Native mobile/desktop UI
- Vite 7.3.1 - Build tool and dev server
- Vapor 4.89.0+ - Swift HTTP server framework

**Testing:**
- Vitest 4.0.17 - Test runner with coverage
- @testing-library/react 16.3.1 - React testing utilities
- jsdom 27.4.0 - DOM environment for tests

**Build/Dev:**
- TypeScript 5.2.2 - Type checking and compilation
- ESLint 9.39.2 - Code linting with flat config
- typescript-eslint 8.53.0 - TypeScript-specific rules
- Tailwind CSS 3.3.5 - Utility-first styling
- PostCSS 8.4.31 - CSS processing

## Key Dependencies

**Critical:**
- GRDB.swift 6.24.0+ - SQLite database wrapper for Swift
- D3.js 7.8.5 - Data visualization library
- @anthropic-ai/sdk 0.71.2 - Claude API integration

**Infrastructure:**
- @radix-ui/* components - Accessible UI primitives
- react-router-dom 6.20.0 - Client-side routing
- react-dnd 16.0.1 - Drag-and-drop interactions
- Leaflet 1.9.4 - Interactive maps
- ZipArchive 2.5.5+ - Archive handling in Swift

**Document Processing:**
- mammoth 1.7.2 - Word document parsing
- xlsx 0.18.5 - Excel file handling
- html2pdf.js 0.10.2 - PDF generation

## Configuration

**Environment:**
- TypeScript with strict mode enabled
- Path aliases: `@/*` → `./src/*`
- Vite with React plugin and asset inclusion for .sql files
- ESNext build target with external sql.js exclusion

**Build:**
- `tsconfig.json` - TypeScript configuration with ES2020 target
- `vite.config.ts` - Build and dev server config
- `vitest.config.ts` - Test runner configuration
- `eslint.config.js` - ESLint 9 flat config format
- `tailwind.config.js` - CSS framework config with custom themes
- `native/Package.swift` - Swift package dependencies

## Platform Requirements

**Development:**
- Node.js with ES2020+ support
- Swift 5.9+ for native development
- iOS 17+ / macOS 14+ for native targets

**Production:**
- React SPA deployment target
- Native iOS/macOS app distribution
- SQLite with FTS5 and recursive CTE support

---

*Stack analysis: 2026-01-25*