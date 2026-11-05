const OPEN_TAG = '<thinking>';
const CLOSE_TAG = '</thinking>';

function partialSuffixLength(text: string, tag: string): number {
  for (let length = Math.min(text.length, tag.length - 1); length > 0; length -= 1) {
    if (text.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

/**
 * Removes `<thinking>…</thinking>` blocks from streamed text.
 *
 * Nova Pro writes its reasoning inside these tags. Tags can be split across
 * chunks, so the filter holds trailing characters that could be the start of a
 * tag until the next chunk resolves them.
 */
export class ThinkingFilter {
  private pending = '';
  private inside = false;

  public push(chunk: string): string {
    this.pending += chunk;
    let visible = '';
    for (;;) {
      if (this.inside) {
        const close = this.pending.indexOf(CLOSE_TAG);
        if (close < 0) {
          this.pending = this.pending.slice(this.pending.length - partialSuffixLength(this.pending, CLOSE_TAG));
          return visible;
        }
        this.pending = this.pending.slice(close + CLOSE_TAG.length);
        this.inside = false;
        continue;
      }
      const open = this.pending.indexOf(OPEN_TAG);
      if (open >= 0) {
        visible += this.pending.slice(0, open);
        this.pending = this.pending.slice(open + OPEN_TAG.length);
        this.inside = true;
        continue;
      }
      const keep = partialSuffixLength(this.pending, OPEN_TAG);
      visible += this.pending.slice(0, this.pending.length - keep);
      this.pending = this.pending.slice(this.pending.length - keep);
      return visible;
    }
  }

  public flush(): string {
    const rest = this.inside ? '' : this.pending;
    this.pending = '';
    this.inside = false;
    return rest;
  }
}
