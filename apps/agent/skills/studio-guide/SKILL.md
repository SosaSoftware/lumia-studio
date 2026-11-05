---
name: studio-guide
description: Explain how Lumia Studio works and guide the person through its screen. Use it for "how do I…", "where is…" or "take me to…" questions, and to find or open a class.
---
# Guiding in Lumia Studio

## The screen
- **Explorer** (left): the tree of the subcategory in view, with folders and classes. Each class shows the state of its content: without content, draft or published. The top bar switches category and subcategory.
- **Components** (left): the catalog in groups (slides, text, media, shapes, interactive, questions). Components are added to the open slide with a click or by dragging.
- **Canvas** (center): the open slide. Click selects a component, dragging moves it, the handles resize it.
- **Properties** (right): the texts, options, position, entrance and timing of the selected component, or the data of the slide.
- **Slides** (bottom): the slides of the class in order, with add, duplicate, move and delete.
- **Timeline** (bottom): narrations, audio and pauses of the open slide, and when each component appears.
- **Comments** and **Lumi** panels.
- **Preview** shows the class as a student sees it. **Publish** publishes the draft; editing a published class creates a new draft version.

## Finding a class
1. The screen context gives the subcategory in view (`scope.subcategoryId`). If the class is elsewhere, `studio-read___list_categories` lists the categories and subcategories the person can see.
2. `studio-read___list_tree(subcategoryId)` lists folders and classes with their ids and state.
3. `open_class(nodeId)` opens it. Use only ids from these results. If several classes match, ask which one.

## Screen tools
- `open_panel(panel)`: `explorer`, `components`, `slides`, `timeline`, `properties`, `comments` or `lumi`. Most panels need an open class.
- `select_slide(slideId)` and `select_element(elementId)`: ids from `get_class` and `get_slide`.
- `highlight_element(target)`: points at a control for a few seconds. Targets: `topbar-preview`, `topbar-publish`, `topbar-category`, `topbar-subcategory`, `slides-add`, `activity-explorer`, `activity-components`, `activity-slides`, `activity-timeline`, `activity-properties`, `activity-comments`, `palette-group-<group>`, `palette-item-<component key>`, `palette-item-slide-<slide type>`, `slide-thumb-<slideId>`, or the id of a component on the canvas.
- `filter_tree(status?, text?)`: filters the tree by state (`all`, `no_content`, `draft`, `published`) or text.
- `start_preview(slideId?)`: opens the preview, from a slide when given.

## How to guide
- Answer in short numbered steps that name the controls as the person sees them.
- Show each control with `open_panel` or `highlight_element` when that helps. One highlight at a time.
- Describe only what is on this page. If the person asks about something Studio does not do, say so.
