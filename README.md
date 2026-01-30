# Isometry

A polymorphic data visualization platform implementing PAFV + LATCH + GRAPH with real-time visualizations and live data subscriptions.

## Quick Start

### React Prototype (Real-Time Visualizations)
```bash
npm install
npm run dev
```

### Production Demo
Visit `/examples/production-viz-demo` for the comprehensive production demonstration featuring:
- **6,891 Apple Notes dataset** with real-time visualization
- **Interactive PAFV filtering** with live visual feedback
- **Performance monitoring** with 60fps validation
- **Stress testing scenarios** for production validation

### Native iOS/macOS
```bash
cd native
open Package.swift  # Opens in Xcode
```

## Features

### Phase 16: Real-Time Visualizations ✨
- **Live Data Integration**: Real-time D3 visualizations with smooth transitions
- **Performance Engine**: 60fps optimization with comprehensive monitoring
- **PAFV Live Filtering**: Dynamic filtering with instant visual feedback
- **Production Testing**: Automated stress testing with full dataset validation

### Visualization Types
- **Network View**: Interactive force-directed graph with 6,891+ nodes
- **Grid View**: Virtual scrolling with real-time updates
- **List View**: Dynamic search with FTS5 integration
- **Enhanced Views**: Performance-optimized variants for production

### Performance Targets
- **60 FPS**: Smooth animations with full dataset
- **<100ms Latency**: Responsive filter changes and data updates
- **Memory Stability**: Leak-free operation during extended use
- **Error Recovery**: Graceful degradation and automatic recovery

## Performance Testing

### Automated Stress Testing
```bash
# Run all stress test scenarios
node scripts/visualization-stress-test.js --scenario=all --headless

# Run specific scenario with full 6,891 dataset
node scripts/visualization-stress-test.js --scenario=full_dataset_render

# Generate performance report
node scripts/visualization-stress-test.js --scenario=memory_stability --report=json
```

### Stress Test Scenarios
- **Full Dataset Render**: 6,891 nodes across all visualization types
- **Rapid Filtering**: PAFV changes every 100ms for 30 seconds
- **Continuous Updates**: Live data simulation for 10 minutes
- **Memory Leak Detection**: 1-hour stability monitoring
- **Concurrent Multi-View**: All visualizations running simultaneously
- **Extended Operation**: 30-minute performance consistency testing

## Documentation

- `CLAUDE.md` - Claude Code project context
- `docs/cardboard-architecture-truth.md` - Architecture
- `docs/PERFORMANCE-BENCHMARKS.md` - Performance targets and optimization
- `design/isometry-ui-handoff/FIGMA-HANDOFF.md` - UI integration guide

## Tech Stack

### React Frontend (Real-Time)
- **Data**: Live data subscriptions with performance monitoring
- **Visualization**: D3.js with optimized transitions and 60fps targeting
- **UI**: React + Tailwind with responsive design
- **Filtering**: PAFV system with live visual feedback
- **Performance**: Comprehensive monitoring and automated testing

### Native Backend
- **Database**: GRDB.swift with SQLite and FTS5 search
- **Sync**: CloudKit integration for multi-device synchronization
- **Bridge**: WebView communication with live data subscriptions
- **Import**: Apple Notes integration (6,891 notes imported)

### Development Tools
- **Stress Testing**: Automated performance validation with Playwright
- **Monitoring**: Real-time performance metrics and alerting
- **Documentation**: Comprehensive benchmarks and optimization guides

*The boring stack wins – with real-time performance.*
