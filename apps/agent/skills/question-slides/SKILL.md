---
name: question-slides
description: Write questions for a class, on a new quiz slide or on an existing slide, from the person's instructions. Use it when the person asks for questions, an exercise or a quiz.
---
# Writing questions

## Steps
1. Read the class with `studio-read___get_class`, and the slide with `studio-read___get_slide` when the questions go on an existing one.
2. Read the catalog with `studio-read___list_components` and no `keys`. Question components are the ones marked `isQuestion`; the slide type for questions is described there too.
3. Read the schema of the question components you will use with `list_components` and `keys`. Follow it exactly: the options and their ids, which answer is correct and the feedback for right and wrong answers.
4. Base the questions on what the person gave you or on the content of the class you read. Do not add topics they did not ask for.
5. Prepare the call:
   - new slide: `studio-slides___add_slides` with the question slide and its question components;
   - existing slide: `studio-elements___add_element` for each question, with `nodeId`, `slideId`, `component` and `props`.
6. Ask for consent with `confirm_change`, one change per call, with summaries such as "Add 4 multiple choice questions about photosynthesis on a new slide at the end". Then wait.
7. When confirmed, run the calls with exactly the approved arguments and say in one sentence what you added.

## Rules
- One clear answer per question unless the person asks for more; write plausible wrong options.
- Write feedback when the component has it: say why an answer is right or wrong, briefly.
- Write in the language the person asks for, or the language of the class.
- Respect the number and kind of questions the person asked for.
