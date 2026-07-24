import { isPersonaId, TurnContext, TurnEvent } from '@enchanted/notes-domain';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { DevUserGuard } from '../auth/dev-user.guard';
import { TurnsService } from './turns.service';

@Controller('turns')
@UseGuards(DevUserGuard)
export class TurnsController {
  constructor(private readonly turns: TurnsService) {}

  /**
   * multipart: `png` (committed page capture) OR `text` (typed turn),
   * plus `context` (TurnContext JSON). Responds with an SSE stream of
   * TurnEvents — Nest's @Sse() is GET/Observable oriented, so we write
   * the stream by hand.
   */
  @Post()
  @UseInterceptors(FileInterceptor('png'))
  async createTurn(
    @UploadedFile() png: Express.Multer.File | undefined,
    @Body('context') contextRaw: string | undefined,
    @Body('text') text: string | undefined,
    @Res() res: Response,
  ) {
    if (!png?.buffer?.length && !text?.trim()) {
      throw new BadRequestException('png or text is required');
    }
    if (!contextRaw) throw new BadRequestException('context is required');

    let ctx: TurnContext;
    try {
      ctx = JSON.parse(contextRaw);
    } catch {
      throw new BadRequestException('context must be valid JSON');
    }
    if (!ctx.notebookId || !ctx.pageId) {
      throw new BadRequestException('context.notebookId and context.pageId are required');
    }
    ctx.recentTurns ??= [];
    ctx.talkTitle ??= 'Untitled talk';
    if (!isPersonaId(ctx.personaHint)) ctx.personaHint = null;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: TurnEvent) =>
      res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      const input = png?.buffer?.length
        ? { png: png.buffer }
        : { text: text?.trim() };
      for await (const event of this.turns.enchantTurn(input, ctx)) {
        send(event);
      }
    } catch (err) {
      send({
        type: 'error',
        message: err instanceof Error ? err.message : 'enchantment failed',
      });
    } finally {
      res.end();
    }
  }

  /** Accept-rewrite: replace the beat's display text (transcript stays original). */
  @Patch(':id')
  updateBeat(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { beatText?: string; rewriteAccepted?: boolean },
  ) {
    if (!body?.beatText?.trim()) {
      throw new BadRequestException('beatText is required');
    }
    return this.turns.updateBeat(user.id, id, {
      beatText: body.beatText.trim(),
      rewriteAccepted: body.rewriteAccepted ?? true,
    });
  }

  @Delete(':id')
  deleteTurn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.turns.deleteTurn(user.id, id);
  }
}
