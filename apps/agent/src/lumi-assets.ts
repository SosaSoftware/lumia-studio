import type { Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Skill } from '@strands-agents/sdk/vended-plugins/skills';
import { ConfirmationPolicy } from './interventions/confirmation-policy.ts';

/** Raised when a file that defines Lumi is missing or invalid. */
export class LumiAssetsError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LumiAssetsError';
  }
}

/**
 * What defines Lumi besides code, read once at start-up from the package: the instructions and the
 * preference-extraction prompt (`src/prompts`), the skills (`skills/<name>/SKILL.md`) and the consent policy
 * (`policies/confirmation.json`). Invalid files stop the start-up instead of failing a conversation later.
 */
export class LumiAssets {
  private constructor(
    /** Instructions of Lumi, appended to the harness contract. */
    public readonly instructions: string,
    /** What counts as a lasting preference of a person. */
    public readonly preferenceExtraction: string,
    public readonly skills: readonly Skill[],
    public readonly confirmationPolicy: ConfirmationPolicy,
  ) {}

  /**
   * @param root - Root of the `@lumia/agent` package, which holds `src/prompts`, `skills` and `policies`.
   * @throws LumiAssetsError when a file is missing or invalid.
   */
  public static async load(root: string): Promise<LumiAssets> {
    const [instructions, preferenceExtraction, policy, skills] = await Promise.all([
      LumiAssets.text(join(root, 'src', 'prompts', 'lumi.md')),
      LumiAssets.text(join(root, 'src', 'prompts', 'preference-extraction.md')),
      LumiAssets.text(join(root, 'policies', 'confirmation.json')),
      LumiAssets.skills(join(root, 'skills')),
    ]);
    let policyJson: unknown;
    try {
      policyJson = JSON.parse(policy);
    } catch (error) {
      throw new LumiAssetsError('policies/confirmation.json is not valid JSON.', { cause: error });
    }
    return new LumiAssets(instructions, preferenceExtraction, skills, ConfirmationPolicy.parse(policyJson));
  }

  /**
   * Every subdirectory of `dir` is a skill. `Skill.fromDirectory` skips invalid skills with a warning, so each one
   * is loaded on its own, in strict mode: a name that does not match its folder, for example, stops the start-up.
   */
  private static async skills(dir: string): Promise<Skill[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new LumiAssetsError(`Cannot read the skills in ${dir}.`, { cause: error });
    }
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    if (folders.length === 0) {
      throw new LumiAssetsError(`No skill found in ${dir}.`);
    }
    return folders.map((folder) => {
      try {
        return Skill.fromFile(join(dir, folder), { strict: true });
      } catch (error) {
        throw new LumiAssetsError(`The skill ${folder} is not valid.`, { cause: error });
      }
    });
  }

  private static async text(path: string): Promise<string> {
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      throw new LumiAssetsError(`Cannot read ${path}.`, { cause: error });
    }
    if (content.trim() === '') {
      throw new LumiAssetsError(`${path} is empty.`);
    }
    return content.trim();
  }
}
