# Daily ToDo Offline

## Overview
Personal daily task widget; preserve the existing translucent floating panel. The signature is a draggable compact checkmark opening a focused daily list. No login, feed or online community UI.

## Colors
Canonical tokens live in style.css :root: page #0d0d12, foreground #f5f7fb, accent #7c3aed, strong accent #6d28d9, focus #a78bfa, danger #ef4444. Reuse these variables.

## Typography
Use the existing local fallback Arial/sans-serif for offline availability. Heading 24px/700; date 12px; form controls inherit body font. No remote fonts or icons.

## Layout
430px task panel with viewport clamps. Keep the full-desktop transparent shell, draggable 58px widget and multi-monitor placement. Footer contains local backups.

## Elevation & Depth
Retain the existing translucent panel and shadow; no extra decorative surfaces.

## Shapes
14px panel and 8px controls, from CSS variables.

## Components
Shared task rows use text inputs, accessible pressed-state toggles and explicit delete confirmation. Status region reports save and import errors. Snippet saving is manual; there is no clipboard watcher. JSON imports validate completely before confirmation and replacement. Local save failure preserves the prior state.

## Do's and Don'ts
Keep all dependencies local at runtime. Render user text through textContent/value. Preserve keyboard operation, visible focus and reduced-motion support. Never add background network calls or silently capture clipboard content.
