import {
  ChangeDetectionStrategy,
  Component,
  output,
} from '@angular/core';
import { PERSONA_META } from '@enchanted/notes-domain';

/**
 * The folded note tucked inside the cover: how the enchantment works.
 * Shown as an overlay — auto-opens once for new users, then lives
 * behind the ? in the toolbar.
 */
@Component({
  selector: 'en-legend',
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <div class="card" (click)="$event.stopPropagation()">
        <p class="intro">
          This notebook is enchanted. Write your talk on the page — when you
          pause, the page drinks your ink and someone writes back in the
          margin.
        </p>
        <ul>
          @for (p of personas; track p.id) {
            <li [style.color]="p.inkColor" [attr.data-font]="p.font">
              <span class="glyph">{{ p.glyph }}</span> {{ p.label }} —
              {{ description(p.id) }}
            </li>
          }
        </ul>
        <p class="outro">
          Draw the glyph in the margin, or press a wax stamp on the right.
          Tap the seal <span class="seal">✦</span> to send at once.
          Tap the ✓ on the Editor's tighter line to replace yours, or on the
          Storyteller's scaffold to weave it into your talk. ▷ replay records
          any moment as a short video you can share.
        </p>
        <button class="tuck" (click)="closed.emit()">
          got it — tuck this note away
        </button>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 20;
      background: rgba(43, 32, 20, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fade-in 0.2s ease-out;
    }

    .card {
      max-width: 620px;
      max-height: 85dvh;
      overflow-y: auto;
      background: #fdf6e3;
      border: 1px dashed rgba(140, 110, 60, 0.55);
      border-radius: 10px;
      box-shadow: 0 14px 40px rgba(30, 20, 8, 0.45);
      transform: rotate(-0.6deg);
      padding: 1.4rem 1.6rem;
      font-family: 'Caveat', cursive;
      color: #4a4238;
      font-size: 1.3rem;
      line-height: 1.4;
      animation: unfold 0.25s ease-out;
    }

    .intro,
    .outro {
      margin: 0;
    }

    ul {
      list-style: none;
      margin: 0.7rem 0;
      padding: 0;
    }

    li {
      font-size: 1.25rem;

      &[data-font='caveat'] {
        font-family: 'Caveat', cursive;
      }
      &[data-font='dancing-script'] {
        font-family: 'Dancing Script', cursive;
      }
      &[data-font='shadows-into-light'] {
        font-family: 'Shadows Into Light', cursive;
      }
    }

    .glyph {
      display: inline-block;
      width: 1.3rem;
      text-align: center;
      font-weight: 600;
    }

    .seal {
      color: #7c1f10;
    }

    .tuck {
      display: block;
      margin: 1.1rem auto 0;
      border: none;
      border-radius: 999px;
      background: #6d3b1f;
      color: #f7e2c0;
      font-family: 'Caveat', cursive;
      font-size: 1.15rem;
      padding: 0.45rem 1.3rem;
      cursor: pointer;

      &:hover {
        background: #7c4527;
      }
    }

    @keyframes fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes unfold {
      from {
        opacity: 0;
        transform: rotate(-0.6deg) translateY(14px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: rotate(-0.6deg) translateY(0) scale(1);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegendComponent {
  readonly closed = output<void>();
  readonly personas = Object.values(PERSONA_META);

  description(id: string): string {
    switch (id) {
      case 'editor':
        return 'tightens your thought into one speakable line';
      case 'skeptic':
        return 'asks the hardest question your point invites';
      case 'coach':
        return 'tells you where to pause, breathe, or cut';
      case 'storyteller':
        return 'hands you an anecdote or metaphor that lands';
      case 'timekeeper':
        return 'estimates your speaking time and what to trim';
      default:
        return '';
    }
  }
}
