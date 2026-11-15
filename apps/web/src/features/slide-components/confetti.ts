import { prefersReducedMotion } from './motion.ts';

const COLORS = ['#2F6BFF', '#3FC5F0', '#12B886', '#F5B800', '#F0569B', '#7C4DFF', '#FF8A3D'];

/** Number of pieces of each intensity. */
const PIECES: Readonly<Record<string, number>> = { low: 24, medium: 48, high: 90 };

/**
 * Throws confetti from the center of `host` and removes it when it lands. The pieces are absolutely positioned
 * children of the host, which must be a positioned box; they ignore pointer events.
 */
export function burstConfetti(host: HTMLElement | null, intensity = 'medium'): void {
  if (host === null || prefersReducedMotion() || typeof host.animate !== 'function') return;
  const rect = host.getBoundingClientRect();
  const reach = Math.max(rect.width, rect.height, 160);
  const count = PIECES[intensity] ?? 48;
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement('span');
    const size = 5 + Math.random() * 7;
    piece.setAttribute('aria-hidden', 'true');
    Object.assign(piece.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${String(size)}px`,
      height: `${String(size * (Math.random() > 0.5 ? 1 : 0.45))}px`,
      background: COLORS[index % COLORS.length] ?? '#2F6BFF',
      borderRadius: Math.random() > 0.6 ? '50%' : '2px',
      pointerEvents: 'none',
      zIndex: '5',
    });
    host.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const distance = reach * (0.25 + Math.random() * 0.55);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - reach * 0.2;
    const spin = (Math.random() - 0.5) * 900;
    const animation = piece.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${String(x)}px), calc(-50% + ${String(y)}px)) rotate(${String(spin * 0.6)}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${String(x * 1.1)}px), calc(-50% + ${String(y + reach * 0.45)}px)) rotate(${String(spin)}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    );
    animation.onfinish = (): void => {
      piece.remove();
    };
  }
}
