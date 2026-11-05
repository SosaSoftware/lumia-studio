import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { TempDir } from '../test/support/conversation-harness.ts';
import { LumiAssets, LumiAssetsError } from './lumi-assets.ts';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const dir = new TempDir();
afterAll(() => {
  dir.dispose();
});

/** A copy of the package assets in a temporary root, to break one file at a time. */
function copyAssets(name: string): string {
  const root = join(dir.path, name);
  for (const part of ['src/prompts', 'skills', 'policies']) {
    cpSync(join(appRoot, part), join(root, part), { recursive: true });
  }
  return root;
}

describe('LumiAssets', () => {
  it('loads the instructions, the skills and the consent policy of the package', async () => {
    const assets = await LumiAssets.load(appRoot);
    expect(assets.instructions).toMatch(/^# Lumi/);
    expect(assets.instructions).toContain('confirm_change');
    expect(assets.preferenceExtraction).toContain('preferences');
    expect(assets.skills.map((skill) => skill.name)).toEqual(['class-editing', 'narration', 'question-slides', 'slide-creation', 'studio-guide']);
    for (const skill of assets.skills) {
      expect(skill.description.length).toBeGreaterThan(40);
      expect(skill.instructions.length).toBeGreaterThan(200);
    }
    expect(assets.confirmationPolicy.confirmationTool).toBe('confirm_change');
  });

  it('stops on a skill whose name does not match its folder', async () => {
    const root = copyAssets('bad-skill');
    mkdirSync(join(root, 'skills', 'my-skill'));
    writeFileSync(join(root, 'skills', 'my-skill', 'SKILL.md'), '---\nname: other-name\ndescription: A skill with the wrong name.\n---\nBody.\n');
    await expect(LumiAssets.load(root)).rejects.toBeInstanceOf(LumiAssetsError);
  });

  it('stops on a missing or empty prompt and on an invalid policy', async () => {
    const emptyPrompt = copyAssets('empty-prompt');
    writeFileSync(join(emptyPrompt, 'src', 'prompts', 'lumi.md'), '  \n');
    await expect(LumiAssets.load(emptyPrompt)).rejects.toBeInstanceOf(LumiAssetsError);

    const badPolicy = copyAssets('bad-policy');
    writeFileSync(join(badPolicy, 'policies', 'confirmation.json'), '{ not json');
    await expect(LumiAssets.load(badPolicy)).rejects.toBeInstanceOf(LumiAssetsError);

    await expect(LumiAssets.load(join(dir.path, 'missing'))).rejects.toBeInstanceOf(LumiAssetsError);
  });
});
