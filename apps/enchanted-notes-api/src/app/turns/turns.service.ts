import {
  Glyph,
  isPersonaId,
  personaForGlyph,
  TurnContext,
  TurnEvent,
} from '@enchanted/notes-domain';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { runPersonaPass } from '../genkit/persona.flow';
import { runVisionPass } from '../genkit/vision.flow';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SentenceChunker } from './sentence-chunker';

@Injectable()
export class TurnsService {
  private readonly logger = new Logger(TurnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The enchantTurn flow: ink (PNG → vision pass) or typed text, then
   * persona pass → sentences. Yields SSE-ready TurnEvents; persists the
   * Turn before emitting `done`.
   */
  async *enchantTurn(
    input: { png?: Buffer; text?: string },
    ctx: TurnContext,
  ): AsyncGenerator<TurnEvent> {
    const startedAt = Date.now();

    let vision: {
      transcript: string;
      glyph: Glyph | null;
      sketchDescription: string | null;
    };
    let userPngUrl = '';
    if (input.png) {
      const pngKey = `${ctx.notebookId}/${ctx.pageId}/${randomUUID()}.png`;
      [userPngUrl, vision] = await Promise.all([
        this.storage.put(pngKey, input.png, 'image/png'),
        runVisionPass(input.png.toString('base64')),
      ]);
    } else {
      // Typed turn: no ink, no vision pass — the text IS the transcript.
      vision = {
        transcript: input.text ?? '',
        glyph: null,
        sketchDescription: null,
      };
    }

    // Explicit rail pick wins over the vision-detected margin glyph.
    const persona = isPersonaId(ctx.personaHint)
      ? ctx.personaHint
      : personaForGlyph(vision.glyph);
    yield {
      type: 'meta',
      transcript: vision.transcript,
      glyph: vision.glyph,
      persona,
      sketchDescription: vision.sketchDescription,
    };

    const chunker = new SentenceChunker();
    const sentences: string[] = [];
    for await (const delta of runPersonaPass(
      persona,
      vision.transcript,
      vision.sketchDescription,
      ctx,
    )) {
      for (const sentence of chunker.push(delta)) {
        sentences.push(sentence);
        yield { type: 'sentence', text: sentence };
      }
    }
    const tail = chunker.flush();
    if (tail) {
      sentences.push(tail);
      yield { type: 'sentence', text: tail };
    }

    const replyText = sentences.join(' ');
    const latencyMs = Date.now() - startedAt;

    const seq = await this.nextSeq(ctx.pageId);
    const turn = await this.prisma.turn.create({
      data: {
        pageId: ctx.pageId,
        seq,
        source: input.png ? 'pen' : 'typed',
        userPngUrl,
        transcript: vision.transcript,
        glyph: vision.glyph,
        persona,
        replyText,
        beatText: vision.transcript,
        latencyMs,
      },
    });

    this.logger.log(`turn ${turn.id} persona=${persona} latency=${latencyMs}ms`);
    yield { type: 'done', turnId: turn.id, replyText, latencyMs };
  }

  async updateBeat(
    userId: string,
    turnId: string,
    patch: { beatText: string; rewriteAccepted: boolean },
  ) {
    const turn = await this.prisma.turn.findFirst({
      where: { id: turnId, page: { notebook: { userId } } },
      select: { id: true },
    });
    if (!turn) throw new NotFoundException('turn not found');
    return this.prisma.turn.update({ where: { id: turnId }, data: patch });
  }

  async deleteTurn(userId: string, turnId: string): Promise<{ ok: true }> {
    const turn = await this.prisma.turn.findFirst({
      where: { id: turnId, page: { notebook: { userId } } },
      select: { id: true },
    });
    if (!turn) throw new NotFoundException('turn not found');
    await this.prisma.turn.delete({ where: { id: turnId } });
    return { ok: true };
  }

  private async nextSeq(pageId: string): Promise<number> {
    const last = await this.prisma.turn.findFirst({
      where: { pageId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });
    return (last?.seq ?? -1) + 1;
  }
}
