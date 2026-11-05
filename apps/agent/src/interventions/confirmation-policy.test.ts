import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfirmationPolicy, ConfirmationPolicyError } from './confirmation-policy.ts';

describe('ConfirmationPolicy', () => {
  it('reads the policy of the package', () => {
    const json: unknown = JSON.parse(readFileSync(new URL('../../policies/confirmation.json', import.meta.url), 'utf8'));
    const policy = ConfirmationPolicy.parse(json);
    expect(policy.confirmationTool).toBe('confirm_change');
    expect(policy.needsConsent('studio-slides___add_slides')).toBe(true);
    expect(policy.needsConsent('studio-elements___update_element')).toBe(true);
    expect(policy.needsConsent('studio-timeline___generate_narration_audio')).toBe(true);
    expect(policy.needsConsent('studio-read___get_class')).toBe(false);
    expect(policy.needsConsent('knowledge___Retrieve')).toBe(false);
  });

  it('guards targets it does not know and leaves tools without a target alone', () => {
    const policy = ConfirmationPolicy.parse({ confirmationTool: 'confirm_change', readOnlyTargets: ['studio-read'], maxChangesPerConfirmation: 3 });
    expect(policy.needsConsent('studio-publishing___publish')).toBe(true);
    expect(policy.needsConsent('confirm_change')).toBe(false);
    expect(policy.needsConsent('todo_write')).toBe(false);
    expect(policy.maxChanges).toBe(3);
  });

  it('rejects an invalid policy', () => {
    expect(() => ConfirmationPolicy.parse({ confirmationTool: '', readOnlyTargets: [], maxChangesPerConfirmation: 0 })).toThrow(ConfirmationPolicyError);
    expect(() => ConfirmationPolicy.parse({ confirmationTool: 'x', readOnlyTargets: ['a'], maxChangesPerConfirmation: 1, extra: true })).toThrow(ConfirmationPolicyError);
  });
});
