import type { Turn, TurnContext, TurnEvent } from '@enchanted/notes-domain';

export async function patchTurn(
  id: string,
  body: { beatText: string; rewriteAccepted: boolean },
): Promise<Turn> {
  const res = await fetch(`/api/turns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`patch turn failed: ${res.status}`);
  return res.json();
}

/**
 * POST committed ink (PNG) or typed text + context; yields typed SSE
 * TurnEvents parsed off the streaming response body.
 */
export async function* postTurn(
  input: { png?: Blob; text?: string },
  ctx: TurnContext,
): AsyncGenerator<TurnEvent> {
  const form = new FormData();
  if (input.png) form.append('png', input.png, 'page.png');
  if (input.text) form.append('text', input.text);
  form.append('context', JSON.stringify(ctx));

  // Watchdog: conference Wi-Fi and tunnels can stall an SSE stream without
  // erroring. If nothing arrives for 30s, abort — "the owl was delayed".
  const STALL_MS = 30_000;
  const abort = new AbortController();
  let stallTimer = setTimeout(() => abort.abort(), STALL_MS);
  const kick = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => abort.abort(), STALL_MS);
  };

  let res: Response;
  try {
    res = await fetch('/api/turns', {
      method: 'POST',
      body: form,
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(stallTimer);
    throw abort.signal.aborted ? new Error('the owl was delayed') : err;
  }
  if (!res.ok || !res.body) {
    clearTimeout(stallTimer);
    throw new Error(`turn request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let done: boolean, value: Uint8Array | undefined;
    try {
      ({ done, value } = await reader.read());
    } catch (err) {
      clearTimeout(stallTimer);
      throw abort.signal.aborted ? new Error('the owl was delayed') : err;
    }
    kick();
    if (done) {
      clearTimeout(stallTimer);
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data: '))
        .map((l) => l.slice(6))
        .join('\n');
      if (data) yield JSON.parse(data) as TurnEvent;
    }
  }
}
