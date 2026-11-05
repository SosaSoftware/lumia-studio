---
name: class-editing
description: Change, move, duplicate or delete existing slides and components, and their texts, layout and timing, from the person's instructions. Use it for any edit of what a class already has.
---
# Editing a class

## Steps
1. Identify what the person means: `selection` in the screen context ("this slide", "this text"), or the slide or component they named. If it is ambiguous, ask.
2. Read the current state: `studio-read___get_class` for the slides and their ids, `studio-read___get_slide` for its components, props, positions and timeline.
3. Prepare the smallest calls that do what was asked:
   - slide data (title, type, background, duration, transition, advance): `studio-slides___update_slide` with only what changes;
   - order: `studio-slides___move_slide` with `position` (1 is the first);
   - copy: `studio-slides___duplicate_slide`; removal: `studio-slides___delete_slide`;
   - a component: `studio-elements___update_element` with only what changes. In `props`, send only the keys that change; they are merged with the current ones, but a list is replaced whole, so send the complete list when you change one item. Geometry (`x`, `y`, `w`, `h`) uses slide units: the slide is 100 wide and 56.25 high;
   - a new component on an existing slide: `studio-elements___add_element`; removal: `studio-elements___delete_element`.
4. Ask for consent with `confirm_change`. For changes to existing items, add `targets` with their kind, id and the label the person sees (the slide title, the component name). For deletions, say in `summary` everything that will be lost. Then wait.
5. When confirmed, run each call with exactly the approved arguments. If the first change created a new draft version, its result has `draft.idMap`: use the new ids for the next calls.
6. Select what changed (`select_slide` or `select_element`) and say in one or two sentences what changed.

## Rules
- Change only what the person asked. Keep the rest of the texts, props and layout as they are.
- Before moving or resizing components, check the free space of the slide with `get_slide` so they do not overlap.
- When editing a published class, the first change creates a new draft; the published version stays as it is until the person publishes.
