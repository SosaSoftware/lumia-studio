---
name: narration
description: Write, change or voice the narration of slides, and place audio and pauses on the timeline, from the person's instructions. Use it for narrations, scripts, voices, background audio and pauses.
---
# Narration and timeline

## Narration
1. Read the slide with `studio-read___get_slide`: its components, existing narrations (`narrationClipId`), audio and pauses, and its duration.
2. For a voice, list them with `studio-read___list_voices` and a `languageCode` (for example `es`), and use a voice id from the result. Use the voice the person asked for, or one the class already uses.
3. Prepare `studio-timeline___save_narration` with `nodeId`: add `slideId` and `script` to create one, or `narrationClipId` and only what changes to change one. `startsAtS` is the second of the slide where it starts; `speed` 1 is normal.
4. Saving a narration does not create its audio. When the person wants to hear it, add a second change, `studio-timeline___generate_narration_audio` with `nodeId` and `narrationClipId`; the id of a new narration only exists after it is saved, so ask for that change once the narration exists.
5. Ask for consent with `confirm_change` and wait. When confirmed, run the calls with exactly the approved arguments and say in one sentence what changed.

## Audio and pauses
- Background music or an effect: find the file with `studio-read___search_media` (`type: "audio"`), then `studio-timeline___save_audio_clip` with `slideId`, `mediaId` and `durationS`.
- A pause: `studio-timeline___save_pause` with `slideId`, `startsAtS` and `durationS`; `onEnd: "wait_click"` waits for a click.

## Rules
- Write scripts to be heard: short sentences, in the language the person asks for or the language of the class.
- Keep the script within what the slide shows unless the person asks otherwise.
- Never invent voice or media ids.
