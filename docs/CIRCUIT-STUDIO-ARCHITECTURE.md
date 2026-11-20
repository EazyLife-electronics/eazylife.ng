# EazyLife Circuit Studio

## Product intent

A public, browser-based schematic illustration editor for creating, refining and publishing circuit diagrams. It is not an electrical simulator, PCB editor or SPICE front end. The primary output is clean, standalone SVG.

## Product decisions

- Public visitors can draw and export without an account.
- Anonymous drafts are stored locally in browser localStorage (with an IndexedDB upgrade planned); portable JSON import/export is the cross-device workflow for the first release.
- Published component assets and curated diagrams are managed through the existing EazyLife admin and Firebase project.
- Both engineering schematic conventions (IEC/ANSI variants) and educational presentation styles are supported.
- Circuit data is structured JSON. SVG is a generated output, never the sole editable source.
- Component artwork, pin geometry and component metadata remain separate.
- Existing STEM lesson diagrams and current Firestore collections must remain unaffected. All future schema additions are additive.

## Application boundaries

Public application:
- `circuit-studio.html`
- `assets/css/circuit-studio.css`
- `js/circuit-studio.js`
- `js/circuit-components.js`

The editor must not initialise Firebase merely to support anonymous drawing. Firebase is introduced only for published library assets, hosted diagrams and authenticated admin management.

## Project model (schema version 1)

A project contains:
- `schemaVersion`
- `title`
- `style`
- `components[]`: unique instance ID, library ID, reference, value, x/y, rotation, mirror flags, optional custom artwork and custom pin geometry
- `wires[]`: unique ID and source/target component-pin references
- `annotations[]`: unique ID, text and position

The project schema is renderer-independent. The renderer can change without migrating every drawing.

## Component model

A component definition contains:
- stable library ID, name, category and reference designator
- version number
- SVG artwork
- local-coordinate pin definitions (ID, name, x, y)
- optional style variants and metadata

Saved instances retain the component version and can optionally override artwork or pin geometry. A future admin publishing workflow will create new versions instead of silently changing existing drawings.

## SVG safety

SVG supplied through an editor must be validated before preview/export/publishing:
- reject scripts, event-handler attributes, foreignObject, embedded HTML and unsafe external references
- disallow external image/font/style imports
- keep pin and interaction overlays outside the artwork
- exported SVG must not contain editor grid, selection boxes, pin handles or other editor-only UI

A production admin upload path must use a stricter sanitizer and server-side validation before a component becomes public.

## Planned stages

1. **Editor foundation:** responsive SVG workspace, grid, zoom, pan, searchable component library, placement, selection, transforms, properties, basic SVG/JSON export and local draft save.
2. **Component refinement:** visual shape/path editor, live SVG source editor, pin editor, component preview/testing, version-aware component definitions.
3. **Wiring engine:** pin snapping, orthogonal routing, junctions, crossing rules, wire editing and undo/redo coverage.
4. **Project persistence:** IndexedDB drafts, import/export validation, autosave, project metadata and recovery.
5. **Firebase/admin:** additive Firestore collections, admin component CRUD/versioning, publication workflow, security rules and asset validation.
6. **Hosted diagrams:** stable slugs, published SVG delivery, version-pinned and latest-version embeds, usage tracking.
7. **Quality and integration:** mobile/touch testing, accessibility, theme checks, STEM module embedding and regression testing.

## Initial acceptance criteria

- Public editor loads without authentication.
- At least 20 starter symbols can be searched and placed.
- Components can be moved, rotated, mirrored, renamed and assigned values.
- Pin coordinates can be adjusted independently from artwork.
- Artwork can be edited as SVG markup with live preview and validation.
- Wires connect defined pins and export correctly.
- Projects can be saved locally, exported as JSON and imported.
- SVG export is standalone and excludes editor-only UI.
- Mobile, dark theme and light theme remain usable.
- No existing site page, Firestore collection or admin workflow is changed by the editor foundation.

## Current implementation note

The first foundation is being developed on `feature/circuit-studio`. The initial milestone is intentionally client-only. The current component artwork editor is source-based with live preview; a direct visual path/node editor is a planned refinement stage, not yet claimed as complete.

## Interaction update (2026-11-20)

- Added explicit Select / Move, Connect wires, Edit pins and Pan tool modes.
- Pin handles are touch-sized. In Edit pins mode, drag a pin directly on the symbol; pin coordinates are stored as per-instance custom pin geometry, separate from artwork.
- Connect wires mode makes the two-pin connection sequence explicit. Created connections are rendered as orthogonal routes and remain attached to the referenced component pins when components move or rotate.
- Pan mode provides a deliberate canvas-drag gesture; Space + drag and middle-mouse pan remain available.
- Rotation remains a discrete 90-degree action rather than free rotation.

The current routing stage uses a generated orthogonal route between endpoints. Manual bend editing, junctions, crossing semantics and multi-segment route persistence remain subsequent work.

## Visual styles and viewport navigation (2026-11-20)

- Engineering style remains the clean monochrome symbol presentation.
- Educational style now visibly changes symbols using soft labelled plates, teal artwork, stronger strokes, and visible pin-name labels. The selected style is restored when loading the saved browser draft.
- Workspace zoom now supports pointer-centred mouse-wheel zoom, pinch-to-zoom on touch screens, and zoom buttons with an expanded 25%–400% range.
- Pinch gestures also translate the viewport with the gesture midpoint. Dedicated Pan mode and Space + drag remain available.
