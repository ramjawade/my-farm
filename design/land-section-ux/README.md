# Land Section UX Mockups

Visual design mockups for the Land section farmer-focused UX improvements.

## Overview

This directory contains high-fidelity design mockups for the Land/Saved Farms management interface improvements. These designs were created to visualize the farmer UX before implementation and serve as reference for future enhancements.

## Files

### Artboards (Individual Screens)

- **FullPage.dc.html** — Complete /map page showing context:
  - Existing address search, zoom, layer toggle, home button (untouched, marked with dashed white outline)
  - Enhanced Saved Lands panel in top-left with dashed green outline
  - Shows how new features integrate with existing controls

- **Main.dc.html** — Saved Lands list (primary artboard):
  - Search filter input at top
  - Status badges (Planted/Fallow/Multiple crops)
  - Per-land quick actions: Rename, View, Delete buttons
  - Active farm highlighting
  - Compact design for map sidebar

- **RenameState.dc.html** — Inline rename interaction:
  - Shows text input replacing land name
  - Save (✓) and Cancel (✕) buttons side-by-side
  - Demonstrates keyboard-driven UX (Enter to save, Escape to cancel)

- **LandDetail.dc.html** — Land detail panel:
  - Land name with status badge
  - Land area display
  - NEW: Notes section for soil type, irrigation, lease info (with edit pencil)
  - Crops on this land with costs
  - Total land cost summary
  - View on map & Add crop action buttons

- **DrawToolbar.dc.html** — Draw mode toolbar:
  - "Map my farm" button (active state)
  - Point count hint
  - NEW: GPS "Locate me" button (with geolocation icon)
  - Undo & Cancel action buttons
  - Satellite/Street basemap toggle (satellite active by default while drawing)
  - Visual "You are here" indicator
  - Satellite imagery background with polygon being drawn

### Canvas Configuration

- **canvas.json** — Artboard layout manifest:
  - Positions, dimensions, and titles for each artboard
  - Annotation notes explaining each section
  - Launch view settings for the design canvas

### Compiled Canvas

- **land-section-ux-mockup.html** — Complete design canvas:
  - Multi-artboard editor with pan/zoom
  - All artboards laid out on infinite canvas
  - Ready to open in Claude Design or browser
  - Use for visual review and refinement

## Features Visualized

1. **Search & Filter** — Quick text lookup for lands
2. **Status Badges** — Visual status indicators (Planted/Fallow/Multiple crops)
3. **Inline Rename** — Edit land names without modal
4. **Optional Notes** — Store soil type, irrigation, lease info
5. **GPS Locate Me** — One-tap geolocation in draw mode
6. **Satellite by Default** — High-resolution imagery while drawing

## Color Palette

- **Farm Green** (#2e7d32) — Primary action, planted crops
- **Soil Brown** (#6d4c41) — Fallow lands, soil/notes context
- **Harvest Orange** (#ff9800) — Multiple crops indicator
- **Neutral Grays** — UI elements, disabled states

## How to Use These

### For Future Enhancement
1. Open `land-section-ux-mockup.html` in Claude Design canvas editor
2. Click artboards to select and tweak design details
3. Use properties panel to adjust colors, spacing, typography
4. Save changes to update all artboards together

### For Reference
- Use these mockups during code review to compare implementation against intended UX
- Reference dimensions, spacing, and visual hierarchy
- Document pixel-perfect specs for design system alignment

### For Feedback
- Share with stakeholders for feedback before implementation
- Use as prototype for user testing
- Compare with implementation screenshots to verify fidelity

## Implementation Status

✅ **Implemented** — All 6 features from these mockups are now live:
- PR #25: Land section UX improvements merged to main
- Search filter, status badges, inline rename, notes field, GPS button, satellite default

## Notes for Future Versions

- Consider adding land image/photo gallery for visual identification
- Explore bulk actions (multi-select lands for batch operations)
- Add crop rotation timeline visualization per land
- Weather/irrigation recommendations based on soil type notes
- Integration with farm planning calendar

---

**Created:** September 4, 2026  
**Design System:** Bootstrap 5.3 + Outfit font  
**Framework:** Angular standalone components with Leaflet maps
