import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  CaptureResult,
  QuillInkComponent,
} from '@codewithahsan/ngx-quill-ink';
import {
  Glyph,
  PERSONA_META,
  PersonaId,
  TurnContext,
  USER_HAND,
} from '@enchanted/notes-domain';
import { AsyncChannel } from '../data/async-channel';
import { LocalTurn } from '../data/db';
import { NotebookStore } from '../data/notebook.store';
import { postTurn } from '../data/turns.api';
import { ReplayExportService } from '../replay/replay-export.service';
import { PersonaRailComponent } from './persona-rail.component';

interface PendingTurn {
  source: 'pen' | 'typed';
  status: 'inFlight' | 'streaming';
  persona: PersonaId | null;
  glyph: Glyph | null;
  transcript: string;
  sentences: AsyncChannel<string>;
  turnId: string | null;
  replyText: string;
  latencyMs: number;
}

interface AcceptingRewrite {
  turnId: string;
  text: string;
}

/**
 * One manuscript page: your talk as a continuous column of beats, with
 * persona annotations anchored in the right margin. A full-page capture
 * surface floats above — write anywhere, the ink dissolves into the
 * next beat.
 */
@Component({
  selector: 'en-page',
  imports: [QuillInkComponent, PersonaRailComponent],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent {
  readonly pageId = input.required<string>();

  private readonly store = inject(NotebookStore);
  readonly replay = inject(ReplayExportService);
  private readonly captureRef =
    viewChild<QuillInkComponent>('captureSurface');
  private readonly manuscriptRef =
    viewChild<ElementRef<HTMLElement>>('manuscript');
  private readonly paperRef = viewChild<ElementRef<HTMLElement>>('paper');

  constructor() {
    // Capture phase: these filters must run BEFORE the ink canvas's own
    // pointer listener, or blocked pointers still draw.
    afterNextRender(() => {
      this.paperRef()?.nativeElement.addEventListener(
        'pointerdown',
        (e) => this.onPointerDown(e),
        { capture: true },
      );
    });
  }

  readonly pending = signal<PendingTurn | null>(null);
  readonly accepting = signal<AcceptingRewrite | null>(null);
  readonly railPersona = signal<PersonaId | null>(null);
  readonly exporting = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  /** 'ink' = stylus/mouse drawing; 'type' = keyboard desk for laptops. */
  readonly mode = signal<'ink' | 'type'>('ink');
  readonly typedText = signal('');

  // fontSize pinned to the static CSS sizes so streaming ink and the
  // settled text render identically (.beat-text 1.7rem ≈ 27px,
  // .annotation 1.15rem ≈ 18px).
  readonly userHandOptions = {
    ...USER_HAND,
    paper: 'none' as const,
    fontSize: 27,
  };

  readonly turns = computed(() =>
    (this.store.turnsByPage()[this.pageId()] ?? []).map((t) => ({
      ...t,
      meta: PERSONA_META[t.persona],
    })),
  );

  /**
   * Palm rejection heuristic (documented in spec): once a pen pointer has
   * been seen, ignore touch pointers on the paper for 60s.
   */
  private lastPenSeen = 0;

  /** The capture overlay eats wheel events — hand them to the manuscript. */
  onWheel(event: WheelEvent): void {
    this.manuscriptRef()?.nativeElement.scrollBy({ top: event.deltaY });
  }

  /** Follow the ink: used when a turn starts, when the reply appears, and when it settles. */
  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const el = this.manuscriptRef()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'pen') this.lastPenSeen = Date.now();
    if (
      event.pointerType === 'touch' &&
      Date.now() - this.lastPenSeen < 60_000
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Only the primary button writes — right/middle click must not ink.
    if (event.pointerType === 'mouse' && event.button !== 0) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /** The page is paper, not an image — no browser context menu. */
  onContextMenu(event: Event): void {
    event.preventDefault();
  }

  /** Wax-seal tap — commit without waiting for the idle timer. */
  commitNow(): void {
    void this.captureRef()?.commitCapture();
  }

  personaOptions(persona: PersonaId) {
    const meta = PERSONA_META[persona];
    return {
      font: meta.font,
      inkColor: meta.inkColor,
      penSpeed: meta.penSpeed,
      paper: 'none' as const,
      fontSize: 18,
    };
  }

  /** Editor rewrites your line; Storyteller's scaffold weaves in below it. */
  canAccept(turn: LocalTurn): boolean {
    return (
      (turn.persona === 'editor' || turn.persona === 'storyteller') &&
      !turn.rewriteAccepted
    );
  }

  personaMeta(persona: PersonaId) {
    return PERSONA_META[persona];
  }

  /**
   * Accidental dots/flicks must not reach the server: require a minimum
   * of real ink (total pen travel + spread) before enchanting.
   */
  private isSubstantive(result: CaptureResult): boolean {
    let travel = 0;
    for (const stroke of result.strokes) {
      for (let i = 1; i < stroke.length; i++) {
        travel += Math.hypot(
          stroke[i][0] - stroke[i - 1][0],
          stroke[i][1] - stroke[i - 1][1],
        );
      }
    }
    const spread = Math.max(result.bounds.width, result.bounds.height);
    return travel >= 120 && spread >= 40;
  }

  async onInk(result: CaptureResult): Promise<void> {
    if (!this.isSubstantive(result)) return; // stray dot — let it fade
    await this.enchant({ png: result.png });
  }

  submitTyped(): void {
    const text = this.typedText().trim();
    if (!text) return;
    this.typedText.set('');
    void this.enchant({ text });
  }

  private async enchant(input: {
    png?: Blob;
    text?: string;
  }): Promise<void> {
    if (this.pending()) return; // one enchantment at a time

    const pending: PendingTurn = {
      source: input.text ? 'typed' : 'pen',
      status: 'inFlight',
      persona: null,
      glyph: null,
      transcript: '',
      sentences: new AsyncChannel<string>(),
      turnId: null,
      replyText: '',
      latencyMs: 0,
    };
    this.pending.set(pending);
    this.scrollToBottom();

    const notebook = this.store.activeNotebook();
    const ctx: TurnContext = {
      notebookId: notebook?.id ?? '',
      pageId: this.pageId(),
      talkTitle: notebook?.title ?? 'Untitled talk',
      targetMinutes: notebook?.targetMinutes ?? null,
      personaHint: this.railPersona(),
      recentTurns: (this.store.turnsByPage()[this.pageId()] ?? [])
        .slice(-6)
        .map((t) => ({
          persona: t.persona,
          transcript: t.transcript,
          replyText: t.replyText,
        })),
    };

    try {
      for await (const event of postTurn(input, ctx)) {
        switch (event.type) {
          case 'meta':
            this.pending.update((p) =>
              p
                ? {
                    ...p,
                    status: 'streaming',
                    persona: event.persona,
                    glyph: event.glyph,
                    transcript: event.transcript,
                  }
                : p,
            );
            this.scrollToBottom(); // the reply surface just appeared
            break;
          case 'sentence':
            pending.sentences.push(event.text + ' ');
            break;
          case 'done':
            this.pending.update((p) =>
              p
                ? {
                    ...p,
                    turnId: event.turnId,
                    replyText: event.replyText,
                    latencyMs: event.latencyMs,
                  }
                : p,
            );
            break;
          case 'error':
            throw new Error(event.message);
        }
      }
      pending.sentences.close();
    } catch (err) {
      pending.sentences.close();
      console.error('enchantment failed', err);
      this.pending.set(null);
      this.showToast(
        err instanceof Error && err.message === 'the owl was delayed'
          ? 'the owl was delayed — try again'
          : 'the spell fizzled — try again',
      );
    }
  }

  /** Annotation fully written — move the pending turn into the manuscript. */
  async onReplyDone(): Promise<void> {
    const p = this.pending();
    if (!p || !p.turnId || !p.persona) return;
    const turn: LocalTurn = {
      id: p.turnId,
      pageId: this.pageId(),
      seq: this.store.turnsByPage()[this.pageId()]?.length ?? 0,
      source: p.source,
      userPngUrl: '',
      transcript: p.transcript,
      glyph: p.glyph,
      persona: p.persona,
      replyText: p.replyText,
      beatText: p.transcript,
      rewriteAccepted: false,
      latencyMs: p.latencyMs,
      createdAt: new Date().toISOString(),
    };
    await this.store.recordTurn(turn);
    this.pending.set(null);
    this.scrollToBottom(); // settled row can be shorter than the ink surface
  }

  /** The Storyteller's woven-in scaffold, split from the user's own words for display. */
  wovenPart(turn: LocalTurn): string | null {
    if (
      turn.persona !== 'storyteller' ||
      !turn.rewriteAccepted ||
      !turn.beatText.startsWith(turn.transcript)
    ) {
      return null;
    }
    return turn.beatText.slice(turn.transcript.length).trim() || null;
  }

  /** Undo an accepted rewrite/weave — the original transcript is kept. */
  canRestore(turn: LocalTurn): boolean {
    return !!turn.rewriteAccepted && !!turn.transcript.trim();
  }

  async restoreRewrite(turn: LocalTurn): Promise<void> {
    if (!this.canRestore(turn)) return;
    await this.store.updateTurnBeat(turn, turn.transcript, false);
    this.showToast('your original words are back');
  }

  async copyBeat(turn: LocalTurn): Promise<void> {
    await navigator.clipboard.writeText(turn.beatText || turn.transcript);
    this.showToast('your words are on the clipboard');
  }

  /** Tap an acceptable note: strike-and-replace (Editor) or weave in (Storyteller). */
  acceptRewrite(turn: LocalTurn): void {
    if (!this.canAccept(turn) || this.accepting()) return;
    this.accepting.set({ turnId: turn.id, text: turn.replyText });
  }

  async onRewriteInked(turn: LocalTurn): Promise<void> {
    const acc = this.accepting();
    if (!acc || acc.turnId !== turn.id) return;
    const current = turn.beatText || turn.transcript;
    const next =
      turn.persona === 'editor' ? acc.text : `${current}\n\n${acc.text}`;
    await this.store.updateTurnBeat(turn, next);
    this.accepting.set(null);
  }

  async deleteTurn(turn: LocalTurn): Promise<void> {
    await this.store.deleteTurn(turn);
  }

  async exportReplay(turn: LocalTurn): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(turn.id);
    this.showToast('recording the spell — about ten seconds…');
    try {
      await this.replay.exportBeat({
        talkTitle: this.store.activeNotebook()?.title ?? 'Untitled talk',
        beatText: turn.beatText || turn.transcript,
        persona: turn.persona,
        replyText: turn.replyText,
        seq: turn.seq,
      });
      this.showToast('replay saved as a video — post it ✦');
    } catch (err) {
      console.error('replay export failed', err);
      this.showToast('the spell fizzled — try again');
    } finally {
      this.exporting.set(null);
    }
  }

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private showToast(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }
}
