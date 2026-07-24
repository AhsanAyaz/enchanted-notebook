/**
 * Re-chunks an LLM token stream into sentence-sized pieces —
 * quill-ink animates most naturally per sentence.
 * Also strips markdown artifacts: persona replies must be speakable ink.
 */
export class SentenceChunker {
  private buffer = '';

  /** Feed a delta; returns zero or more completed sentences. */
  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    // Split on sentence-ending punctuation followed by whitespace.
    let match: RegExpExecArray | null;
    const re = /[.!?…]["')\]]?\s+/g;
    let consumed = 0;
    while ((match = re.exec(this.buffer))) {
      const end = match.index + match[0].length;
      const sentence = stripMarkdown(this.buffer.slice(consumed, end).trim());
      if (sentence) out.push(sentence);
      consumed = end;
    }
    this.buffer = this.buffer.slice(consumed);
    return out;
  }

  /** Flush any trailing partial sentence. */
  flush(): string | null {
    const rest = stripMarkdown(this.buffer.trim());
    this.buffer = '';
    return rest || null;
  }
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '') // headers
    .replace(/^\s*[-*+]\s+/gm, '') // bullets
    .replace(/^\s*\d+\.\s+/gm, '') // numbered lists
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/^>\s+/gm, '') // blockquotes
    .replace(/\s+/g, ' ')
    .trim();
}
