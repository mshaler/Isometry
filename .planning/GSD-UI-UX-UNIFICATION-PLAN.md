# GSD Execution Plan: UI/UX Unification

## Goal Definition
**Objective**: Unify our proven MVP functionality with the comprehensive Figma-designed interface, creating a cohesive, production-ready UI/UX that maintains data visualization capability while adding professional design.

**Success Criteria**:
- MVP data visualization functionality preserved
- Figma design components fully integrated
- Dual theme system (NeXTSTEP + Modern macOS 26) working
- Responsive layout with proper component composition
- All interactions functional (drag-drop, filtering, navigation)

## Current State Analysis

### ✅ **Working MVP Components**:
- `src/MVPDemo.tsx` - Minimal demo with proven data visualization
- `src/hooks/useMockData.ts` - Reliable mock data provider
- `src/components/Canvas.tsx` - Working Canvas with GridView integration
- Comprehensive test suite (18/18 tests passing)

### 🎨 **Available Figma Components** (9 components):
- `Toolbar.tsx` - App menu bar + command buttons
- `Navigator.tsx` - Apps/Views/Datasets/Graphs dropdowns
- `PAFVNavigator.tsx` - Drag-drop axis assignment wells
- `Sidebar.tsx` - LATCH filters + Templates tabs
- `RightSidebar.tsx` - Formats + Settings tabs
- `Canvas.tsx` - Enhanced canvas with Excel-style tabs
- `Card.tsx` - Data card with properties table
- `NavigatorFooter.tsx` - Location map + Time slider
- `CommandBar.tsx` - DSL command input

### 📐 **UI Infrastructure Available**:
- 50+ shadcn/ui components ready to use
- `ThemeContext.tsx` with NeXTSTEP/Modern themes
- Complete Tailwind configuration with NeXTSTEP colors
- react-dnd setup for drag-drop functionality

## Gap Analysis

### **Integration Challenges**:
1. **Component Composition**: Figma App.tsx vs our MVPDemo.tsx structure
2. **Data Binding**: Figma components have hardcoded data vs our dynamic mock data
3. **State Management**: Figma uses local state vs our context providers
4. **Canvas Integration**: Figma Canvas shows cards vs our GridView D3 visualization
5. **Theme Consistency**: Ensure all components support both NeXTSTEP + Modern themes

### **Dependencies Required**:
- `react-dnd` + `react-dnd-html5-backend` (drag-drop)
- `lucide-react` (icons)
- Updated Tailwind config with NeXTSTEP colors

## Execution Strategy

### Phase 1: Foundation Setup
**Prepare infrastructure for component integration**

**Task 1.1**: Install missing dependencies
- Add react-dnd for PAFVNavigator wells
- Add lucide-react for consistent icons
- Verify Tailwind NeXTSTEP color configuration

**Task 1.2**: Set up component structure
- Copy Figma components to `src/components/figma/`
- Create component integration mapping
- Preserve existing MVP components for reference

**Task 1.3**: Theme system validation
- Test ThemeContext with NeXTSTEP/Modern switching
- Verify Tailwind NeXTSTEP color classes work
- Create theme preview components

### Phase 2: Component Migration & Integration
**Systematically integrate each Figma component**

**Task 2.1**: Core Layout Components (Toolbar, Navigator)
- Integrate Toolbar.tsx with menu functionality
- Connect Navigator.tsx to AppStateContext
- Wire up theme switching in Toolbar

**Task 2.2**: PAFV System Integration (PAFVNavigator)
- Connect PAFVNavigator wells to PAFVContext
- Implement drag-drop state persistence
- Test with mock data facets

**Task 2.3**: Sidebar Systems (Sidebar, RightSidebar)
- Integrate Sidebar LATCH filters with FilterContext
- Connect RightSidebar to formatting systems
- Implement accordion state management

**Task 2.4**: Canvas & Data Integration
- Merge Figma Canvas.tsx with our working Canvas
- Preserve GridView data visualization functionality
- Integrate Card.tsx for detailed node display
- Add sheet tab functionality

**Task 2.5**: Footer & Command Systems
- Integrate NavigatorFooter map + time slider
- Connect CommandBar to future DSL system
- Add collapsible footer functionality

### Phase 3: Data Binding & State Integration
**Connect Figma components to real data and state**

**Task 3.1**: Replace hardcoded data with dynamic data
- Navigator dropdowns → mock data categories
- PAFVNavigator chips → mock data facets
- Sidebar filters → FilterContext state
- Card properties → actual node data

**Task 3.2**: State management integration
- Wire all contexts (Theme, AppState, Filter, PAFV)
- Ensure URL state synchronization
- Test state persistence across component interactions

**Task 3.3**: MVP functionality preservation
- Ensure all MVP data visualization continues working
- Maintain 18 test suite passing
- Verify no regression in core functionality

### Phase 4: Layout & Responsive Design
**Create cohesive layout and responsive behavior**

**Task 4.1**: Unified layout composition
- Create new UnifiedApp.tsx combining all components
- Implement proper layout grid system
- Handle component resizing and collapsing

**Task 4.2**: Responsive behavior
- Mobile/tablet layout adaptations
- Panel collapsing/expanding
- Maintain usability across screen sizes

**Task 4.3**: Polish & refinement
- Smooth transitions between states
- Consistent spacing and typography
- Performance optimization

## Implementation Details

### Architectural Approach
```tsx
// Unified App Structure
<UnifiedApp>
  ├── Toolbar (menu + commands)
  ├── Navigator (app/view selectors)
  ├── PAFVNavigator (axis wells)
  ├── MainContent
  │   ├── Sidebar (LATCH filters)
  │   ├── Canvas (with MVP data visualization)
  │   └── RightSidebar (formats/settings)
  ├── NavigatorFooter (map + time)
  └── CommandBar (DSL input)
</UnifiedApp>
```

### Data Flow Strategy
```
Mock Data → FilterContext → GridView → Canvas
     ↓
PAFVContext → Axis Mapping → Spatial Organization
     ↓
ThemeContext → Visual Styling → NeXTSTEP/Modern
```

### Component Integration Pattern
1. **Copy** Figma component to `src/components/figma/`
2. **Adapt** imports and context dependencies
3. **Connect** to existing state management
4. **Test** functionality with mock data
5. **Integrate** into unified layout

### Testing Strategy
Each phase includes:
- **Unit tests** for individual component integration
- **Integration tests** for component composition
- **Visual regression tests** for theme switching
- **Functional tests** for user workflows
- **Performance tests** for rendering efficiency

## Success Metrics

### Phase 1 Success:
- ✅ All dependencies installed without conflicts
- ✅ Theme system working with both NeXTSTEP + Modern
- ✅ Component structure established

### Phase 2 Success:
- ✅ All 9 Figma components successfully integrated
- ✅ Basic functionality working (dropdowns, drag-drop, accordions)
- ✅ Theme switching affects all components

### Phase 3 Success:
- ✅ MVP data visualization preserved and enhanced
- ✅ All contexts properly connected
- ✅ Dynamic data replaces hardcoded values
- ✅ 18+ tests passing (maintain or expand test suite)

### Phase 4 Success:
- ✅ Cohesive, professional UI/UX
- ✅ Responsive design across devices
- ✅ Smooth interactions and performance
- ✅ Production-ready interface

## Risk Mitigation

### **Risk**: Breaking MVP functionality during integration
- **Mitigation**: Keep MVPDemo.tsx as fallback, incremental integration
- **Test**: Continuous validation of core data visualization

### **Risk**: Theme system conflicts
- **Mitigation**: Gradual theme integration, component isolation
- **Test**: Theme switching validation after each component

### **Risk**: Performance degradation with complex UI
- **Mitigation**: Performance monitoring, component optimization
- **Test**: Performance benchmarks maintained

### **Risk**: State management complexity
- **Mitigation**: Preserve existing context architecture
- **Test**: State flow validation, no context conflicts

## Post-Integration Roadmap

### Immediate (Phase 5):
1. **Database Integration**: Replace mock data with real SQLite
2. **D3 Enhancement**: Add remaining view types (List, Network, Timeline)
3. **DSL Implementation**: Connect CommandBar to filter DSL

### Short-term (Phase 6):
1. **User Testing**: Gather feedback on UI/UX
2. **Performance Optimization**: Bundle size, rendering speed
3. **Accessibility**: WCAG compliance, keyboard navigation

### Long-term (Phase 7):
1. **Advanced Features**: Saved views, export functionality
2. **Native Integration**: Swift UI counterpart synchronization
3. **Plugin System**: Extensible visualization types

## Files to Create/Modify

### New Files:
- `.planning/GSD-UI-UX-UNIFICATION-PLAN.md` (this file)
- `src/components/UnifiedApp.tsx` - Main layout composition
- `src/components/figma/*.tsx` - Copied Figma components
- `src/__tests__/ui-unification-*.test.tsx` - Integration tests

### Modified Files:
- `src/App.tsx` - Switch to UnifiedApp
- `tailwind.config.js` - NeXTSTEP color additions
- `package.json` - New dependencies
- `src/contexts/*` - Enhanced context integration

This plan provides a systematic approach to unify our proven MVP with professional Figma design while maintaining data visualization capability and following GSD methodology.