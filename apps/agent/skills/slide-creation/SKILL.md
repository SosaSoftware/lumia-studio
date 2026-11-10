---
name: slide-creation
description: Create slides in a class from the person's instructions, with their components and texts. Use it when the person asks for new slides, a cover, a closing or the content of an empty class.
---
# Creating slides

## Steps
1. Find the class: `record.nodeId` of the screen context, or the class the person named.
2. Read it with `studio-read___get_class`: its state, its slides in order and their positions. An empty class has `status: no_content`; adding slides creates its first version.
3. Read the catalog with `studio-read___list_components` and no `keys`: the components, with what each one is for. Choose the components that fit what the person asked.
4. Read the schema of each component you will use with `studio-read___list_components` and `keys` (for example `["title", "bullet_list"]`). Build `props` that follow it; what you leave out takes its default.
5. Prepare one `studio-slides___add_slides` call with `nodeId`, `afterPosition` when the slides go somewhere other than the end (0 puts them first), and `slides` in order. Each slide has a `title` of up to 40 characters and `elements` (`component`, `props`, and optionally `name`, `appearsAtS`, `entrance`). It can also have `background`, `durationS`, `transition` and `advance`; what you leave out takes its default. Leave out `x`, `y`, `w` and `h`: Studio places the title on top and the rest of the components below it. Without `elements`, a slide is blank.
6. Ask for consent with `confirm_change`: one change with `action: "studio-slides___add_slides"`, the exact `arguments` and a `summary` such as "Add 3 slides after slide 2: cover, explanation and closing". Then wait.
7. When confirmed, run `add_slides` with exactly those arguments. If it answers `invalid_input`, fix what the message points at and ask again.
8. Select the first new slide with `select_slide` and say in one or two sentences what you added.

## Rules
- Make exactly what the person asked: the number of slides, the order, the texts. Do not add slides or components they did not ask for.
- A slide that has question components advances when its questions are done: give it `advance: "on_complete"`.
- Write the texts in the language the person asks for, or the language of the class.
- Media components need a media id from `studio-read___search_media`; if there is none that fits, tell the person instead of inventing one.
- For many slides, send them in one confirmation and one call when possible, so the person approves the whole set once.
