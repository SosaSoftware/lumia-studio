import { z } from 'zod';
import { targetOf } from '../mcp/studio-access.ts';

const ConfirmationPolicySchema = z.strictObject({
  /** Frontend tool that asks the person to confirm. */
  confirmationTool: z.string().min(1),
  /**
   * Gateway targets whose tools only read. Every other gateway tool changes Studio and needs consent, so a target
   * added later is guarded until it is listed here.
   */
  readOnlyTargets: z.array(z.string().min(1)).min(1),
  /** Most changes one confirmation may carry. */
  maxChangesPerConfirmation: z.number().int().min(1).max(100),
});

/** When Lumi needs the consent of the person, from `policies/confirmation.json`. */
export type ConfirmationPolicyData = z.infer<typeof ConfirmationPolicySchema>;

/** Raised when the policy file does not match its schema. */
export class ConfirmationPolicyError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ConfirmationPolicyError';
  }
}

/** The consent rules of Lumi. */
export class ConfirmationPolicy {
  private constructor(public readonly data: ConfirmationPolicyData) {}

  /** @throws ConfirmationPolicyError when `json` is not a valid policy. */
  public static parse(json: unknown): ConfirmationPolicy {
    const parsed = ConfirmationPolicySchema.safeParse(json);
    if (!parsed.success) {
      throw new ConfirmationPolicyError(`Invalid confirmation policy: ${z.prettifyError(parsed.error)}`);
    }
    return new ConfirmationPolicy(parsed.data);
  }

  public get confirmationTool(): string {
    return this.data.confirmationTool;
  }

  public get maxChanges(): number {
    return this.data.maxChangesPerConfirmation;
  }

  /** Whether a tool changes Studio: a gateway tool outside the read-only targets. */
  public needsConsent(toolName: string): boolean {
    const target = targetOf(toolName);
    return target !== null && !this.data.readOnlyTargets.includes(target);
  }
}
