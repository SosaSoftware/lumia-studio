---
name: slide-creation
description: Create slides in a class from the person's instructions, with their components and texts. Use it when the person asks for new slides, a cover, a closing or the content of an empty class.
---
# Creating slides

## Steps
1. Find the class: `record.nodeId` of the screen context, or the class the person named.
2. Read it with `studio-read___get_class`: its state, its slides in order and their positions. An empty class has `status: no_content`; adding slides creates its first version.
3. Read the catalog with `studio-read___list_components` and no `keys`: the components, with what each one is for. Choose the components that fit what the person asked.
4. Read the schema of each component you will use with `studio-read___list_components` and `keys` (for example `["title", "bullet_list"]`). Build `props` that follow it; what you leave out takes its default. `panel` lists the props by section of the Properties panel, in the order the person sees them: fill `content` and `answer`; leave `appearance` and `motion` at their defaults unless the person asks; props marked `advanced` are optional, and a prop with `visibleWhen` only applies when that condition holds.
5. Prepare one `studio-slides___add_slides` call with `nodeId`, `afterPosition` when the slides go somewhere other than the end (0 puts them first), and `slides` in order. Each slide has a `title` of up to 40 characters and `elements` (`component`, `props`, and optionally `name`, `appearsAtS`, `entrance`). It can also have `background`, `durationS`, `transition` and `unlock`; what you leave out takes its default. Leave out `x`, `y`, `w` and `h`: Studio places the title on top and the rest of the components below it. Without `elements`, a slide is blank.
6. Ask for consent with `confirm_change`: one change with `action: "studio-slides___add_slides"`, the exact `arguments` and a `summary` such as "Add 3 slides after slide 2: cover, explanation and closing". Then wait.
7. When confirmed, run `add_slides` with exactly those arguments. If it answers `invalid_input`, fix what the message points at and ask again.
8. Select the first new slide with `select_slide` and say in one or two sentences what you added.

## Rules
- Make exactly what the person asked: the number of slides, the order, the texts. Do not add slides or components they did not ask for.
- A slide never moves on by itself: the student presses the Next button beside the slide. `unlock` says when that button turns on:
  - `always`: from the start.
  - `after_time`: once `durationS` has run. `startMode` says when the time starts: `auto` when the slide opens, or `button` when the student presses its start button (a `button_link` with `action: "start_slide"`). Until then the slide waits: no clock, no narration, no entrances.
  - `after_activities`: once its questions and games are completed. Give it to slides with questions or games.
  - `custom_button`: the lateral Next is not used; a `button_link` of the slide with `action: "next_slide"` or `"go_to_slide"` moves on instead.
- Buttons are referenced by element id, so they exist only after `add_slides`: set `startElementId` or `unlockElementId` afterwards with `studio-slides___update_slide`.
- A `button_link` with `action: "go_to_slide"` takes the slide number in `target`.
- An element can leave its slide: `exit` (`disappear`, `fade` or `slide`) with `disappearsAtS`, later than `appearsAtS`. Without `exit` it stays until the slide ends. The start button always appears at second 0.
- Write the texts in the language the person asks for, or the language of the class.
- Media components need a media id from `studio-read___search_media`; if there is none that fits, tell the person instead of inventing one.
- For many slides, send them in one confirmation and one call when possible, so the person approves the whole set once.
