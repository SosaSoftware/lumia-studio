/**
 * Generates the Cedar policy of a role (one shape for every role): the role's actions on records
 * of the categories and subcategories granted to the person. A record without those attributes
 * (for example the component catalog) only needs the action.
 * Each scope clause is `(has && contains) || !has`: the Cedar validator only accepts the attribute
 * access when a positive `has` guards it in the same conjunction.
 */
// A static entry point keeps the generator free of state.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PolicyGenerator {
  /** @returns the policy text, or null when the role has no actions. */
  public static forRole(roleKey: string, actions: readonly string[]): string | null {
    if (actions.length === 0) return null;
    const list = actions.map((action) => `    Studio::Action::${JSON.stringify(action)}`).join(',\n');
    return [
      'permit (',
      `  principal in Studio::Role::${JSON.stringify(roleKey)},`,
      '  action in [',
      list,
      '  ],',
      '  resource',
      ')',
      'when {',
      '  ((resource has category && principal.categories.contains(resource.category)) || !(resource has category)) &&',
      '  ((resource has subcategory && principal.subcategories.contains(resource.subcategory)) || !(resource has subcategory))',
      '};',
      '',
    ].join('\n');
  }
}
