import { Injectable } from '@angular/core';
import { InkSurface } from '@codewithahsan/quill-ink-core';
import { PERSONA_META, PersonaId, USER_HAND } from '@enchanted/notes-domain';

export interface ReplayInput {
  talkTitle: string;
  beatText: string;
  persona: PersonaId;
  replyText: string;
  seq: number;
}

const W = 1080;
const H = 1920;
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm',
];

/**
 * The viral moment, exportable: replays a beat + its annotation as
 * animated handwriting on a portrait canvas, records it, and hands the
 * viewer a video. Frontend-only — quill-ink core surfaces on detached
 * canvases, composited per frame into a captured stream.
 */
@Injectable({ providedIn: 'root' })
export class ReplayExportService {
  readonly mimeType = MIME_CANDIDATES.find(
    (m) =>
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
  );
  readonly supported = !!this.mimeType;

  async exportBeat(input: ReplayInput): Promise<void> {
    if (!this.mimeType) throw new Error('MediaRecorder unsupported');

    // Source canvases are laid out in logical (CSS) pixels; InkSurface
    // multiplies by devicePixelRatio internally, so we drawImage with
    // explicit destination sizes and stay resolution-independent.
    const title = this.surface(W - 160, 220, {
      ...USER_HAND,
      fontSize: 64,
      penSpeed: 1400,
    });
    const beat = this.surface(W - 160, 620, { ...USER_HAND, fontSize: 48 });
    const meta = PERSONA_META[input.persona];
    const annotation = this.surface(W - 200, 720, {
      font: meta.font,
      inkColor: meta.inkColor,
      penSpeed: meta.penSpeed,
      fontSize: 44,
    });

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('no 2d context');

    let watermarkAlpha = 0;
    let personaStampAlpha = 0;
    let raf = 0;
    const paint = () => {
      this.paintPaper(ctx);
      ctx.drawImage(title.canvas, 80, 120, W - 160, 220);
      ctx.drawImage(beat.canvas, 80, 420, W - 160, 620);
      if (personaStampAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = personaStampAlpha;
        ctx.fillStyle = meta.inkColor;
        ctx.font = '52px "Caveat", cursive';
        ctx.fillText(`${meta.glyph} ${meta.label}`, 100, 1105);
        ctx.restore();
      }
      ctx.drawImage(annotation.canvas, 100, 1140, W - 200, 720);
      if (watermarkAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = watermarkAlpha;
        ctx.fillStyle = '#6d3b1f';
        ctx.font = '44px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('✦ enchanted notes', W / 2, H - 90);
        ctx.restore();
      }
      raf = requestAnimationFrame(paint);
    };
    paint();

    const stream = out.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: this.mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(1000);

    try {
      await title.surface.write(input.talkTitle).done;
      await this.wait(800);
      await beat.surface.write(input.beatText).done;
      await this.wait(700);
      await this.fade((a) => (personaStampAlpha = a), 400);
      await annotation.surface.write(input.replyText).done;
      await this.wait(400);
      await this.fade((a) => (watermarkAlpha = a), 600);
      await this.wait(1500);
    } finally {
      recorder.stop();
      await stopped;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      title.surface.destroy();
      beat.surface.destroy();
      annotation.surface.destroy();
    }

    const ext = this.mimeType.includes('mp4') ? 'mp4' : 'webm';
    // Strip codec params — some browsers refuse to name downloads for
    // exotic MIME strings, which drops the file extension.
    const blob = new Blob(chunks, { type: this.mimeType.split(';')[0] });
    const name = `enchanted-${this.slug(input.talkTitle)}-beat-${
      input.seq + 1
    }.${ext}`;
    await this.deliver(blob, name, input.talkTitle);
  }

  private surface(
    width: number,
    height: number,
    opts: {
      font: string;
      inkColor: string;
      penSpeed: number;
      fontSize: number;
    },
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const surface = new InkSurface({
      canvas,
      font: opts.font as 'caveat',
      inkColor: opts.inkColor,
      penSpeed: opts.penSpeed,
      fontSize: opts.fontSize,
      paper: 'none',
    });
    return { canvas, surface };
  }

  private paintPaper(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140, 110, 60, 0.16)';
    ctx.lineWidth = 2;
    for (let y = 64; y < H; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  private async fade(set: (a: number) => void, ms: number): Promise<void> {
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (t: number) => {
        const a = Math.min(1, (t - start) / ms);
        set(a);
        if (a < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private slug(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'talk'
    );
  }

  private async deliver(
    blob: Blob,
    name: string,
    title: string,
  ): Promise<void> {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch {
        // user dismissed the sheet — fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
