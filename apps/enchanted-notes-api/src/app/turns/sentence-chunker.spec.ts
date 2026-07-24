import { SentenceChunker, stripMarkdown } from './sentence-chunker';

describe('SentenceChunker', () => {
  it('emits sentences as they complete across deltas', () => {
    const c = new SentenceChunker();
    expect(c.push('Cut the demo ')).toEqual([]);
    expect(c.push('story. Then breathe. And')).toEqual([
      'Cut the demo story.',
      'Then breathe.',
    ]);
    expect(c.flush()).toBe('And');
  });

  it('handles question and exclamation marks', () => {
    const c = new SentenceChunker();
    expect(c.push('Really? Yes! Sure. tail')).toEqual([
      'Really?',
      'Yes!',
      'Sure.',
    ]);
    expect(c.flush()).toBe('tail');
  });

  it('returns null flush when empty', () => {
    const c = new SentenceChunker();
    expect(c.flush()).toBeNull();
  });

  it('strips markdown from sentences', () => {
    const c = new SentenceChunker();
    expect(c.push('**Bold** and `code` here. ')).toEqual([
      'Bold and code here.',
    ]);
  });
});

describe('stripMarkdown', () => {
  it('removes bullets, headers, emphasis', () => {
    expect(stripMarkdown('# Title')).toBe('Title');
    expect(stripMarkdown('- item one')).toBe('item one');
    expect(stripMarkdown('*emph* _also_')).toBe('emph also');
  });
});
