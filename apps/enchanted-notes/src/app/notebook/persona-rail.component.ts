import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { PERSONA_META, PersonaId } from '@enchanted/notes-domain';

/**
 * Wax-stamp rail: pick who answers your next thought without drawing a
 * glyph. Sticky until changed — tap the same stamp again to release it
 * (back to glyph detection / the Editor).
 */
@Component({
  selector: 'en-persona-rail',
  template: `
    @for (p of personas; track p.id) {
      <div class="slot">
        <span class="tip" [style.--stamp-color]="p.inkColor">
          {{ p.glyph }} {{ p.label
          }}{{ selected() === p.id ? ' — answers next' : '' }}
        </span>
        <button
          class="stamp"
          [class.selected]="selected() === p.id"
          [style.--stamp-color]="p.inkColor"
          [attr.aria-pressed]="selected() === p.id"
          [attr.aria-label]="p.label"
          (click)="toggle(p.id, $event)"
        >
          {{ p.glyph }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .slot {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .tip {
      position: absolute;
      right: 52px;
      white-space: nowrap;
      background: #fdf6e3;
      color: var(--stamp-color);
      border: 1.5px solid var(--stamp-color);
      border-radius: 999px;
      padding: 0.15rem 0.7rem;
      font-family: 'Caveat', cursive;
      font-size: 1.05rem;
      box-shadow: 1px 2px 5px rgba(60, 40, 20, 0.2);
      opacity: 0;
      transform: translateX(6px);
      transition:
        opacity 0.15s ease,
        transform 0.15s ease;
      pointer-events: none;
    }

    .slot:hover .tip,
    .slot:focus-within .tip {
      opacity: 1;
      transform: translateX(0);
    }

    .stamp {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid var(--stamp-color);
      background: #fdf6e3;
      color: var(--stamp-color);
      font-size: 1.3rem;
      font-family: 'Caveat', cursive;
      cursor: pointer;
      box-shadow: 1px 2px 4px rgba(60, 40, 20, 0.25);
      transition: transform 0.15s ease;

      &:hover {
        transform: scale(1.08);
      }

      &.selected {
        background: var(--stamp-color);
        color: #fdf6e3;
        animation: ember 1s ease-out 1;
      }
    }

    @keyframes ember {
      0% {
        box-shadow: 0 0 0 rgba(255, 120, 30, 0);
      }
      35% {
        box-shadow:
          0 0 12px rgba(255, 120, 30, 0.9),
          0 0 24px rgba(255, 180, 60, 0.5);
      }
      100% {
        box-shadow: 1px 2px 4px rgba(60, 40, 20, 0.25);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonaRailComponent {
  readonly selected = model<PersonaId | null>(null);
  readonly personas = Object.values(PERSONA_META);

  toggle(id: PersonaId, event: Event): void {
    this.selected.set(this.selected() === id ? null : id);
    // Mouse users: drop focus so the tip doesn't linger over the margin.
    // Keyboard users keep focus (and the tip) until they tab away.
    if ((event as PointerEvent).detail > 0) {
      (event.currentTarget as HTMLElement).blur();
    }
  }
}
