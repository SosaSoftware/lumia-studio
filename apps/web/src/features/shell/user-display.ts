import type { AuthUser } from '../../auth/auth-provider.ts';

/** Up to two initials of the name, or the first two letters of a single word. */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => word !== '');
  const [first, second] = words;
  if (first === undefined) return '';
  if (second === undefined) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}

export function firstName(user: AuthUser | null): string {
  return user?.name.split(/\s+/)[0] ?? '';
}
