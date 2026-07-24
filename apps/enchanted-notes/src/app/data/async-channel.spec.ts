import { AsyncChannel } from './async-channel';

describe('AsyncChannel', () => {
  it('delivers pushed values in order and ends on close', async () => {
    const ch = new AsyncChannel<string>();
    ch.push('one');
    ch.push('two');
    const received: string[] = [];
    const consumer = (async () => {
      for await (const v of ch) received.push(v);
    })();
    // push while consuming, then close
    ch.push('three');
    ch.close();
    await consumer;
    expect(received).toEqual(['one', 'two', 'three']);
  });

  it('ignores pushes after close', async () => {
    const ch = new AsyncChannel<number>();
    ch.close();
    ch.push(42);
    const received: number[] = [];
    for await (const v of ch) received.push(v);
    expect(received).toEqual([]);
  });
});
