import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotebookStore } from '../data/notebook.store';
import { LegendComponent } from './legend.component';
import { PageComponent } from './page.component';

const LEGEND_SEEN_KEY = 'enchanted-legend-seen';

@Component({
  selector: 'en-notebook',
  imports: [PageComponent, LegendComponent],
  templateUrl: './notebook.component.html',
  styleUrl: './notebook.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotebookComponent implements OnInit {
  readonly store = inject(NotebookStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly turning = signal<'forward' | 'back' | null>(null);
  /** Auto-open once for new users; afterwards behind the ? button. */
  readonly legendOpen = signal(!localStorage.getItem(LEGEND_SEEN_KEY));
  readonly pageLabel = computed(
    () => `${this.store.activePageIndex() + 1} / ${this.store.pages().length}`,
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.store.openNotebook(id);
  }

  back(): void {
    void this.router.navigate(['/']);
  }

  openLegend(): void {
    this.legendOpen.set(true);
  }

  closeLegend(): void {
    localStorage.setItem(LEGEND_SEEN_KEY, '1');
    this.legendOpen.set(false);
  }

  async nextPage(): Promise<void> {
    const index = this.store.activePageIndex();
    if (index >= this.store.pages().length - 1) {
      const page = await this.store.addPage();
      if (!page) return;
    }
    this.animateTurn('forward', () =>
      this.store.activePageIndex.set(index + 1),
    );
  }

  async tearOutPage(): Promise<void> {
    const page = this.store.activePage();
    if (!page) return;
    const hasInk = (this.store.turnsByPage()[page.id] ?? []).length > 0;
    if (
      hasInk &&
      !confirm('Tear out this page? Its ink is gone for good.')
    ) {
      return;
    }
    await this.store.deleteActivePage();
  }

  prevPage(): void {
    const index = this.store.activePageIndex();
    if (index === 0) return;
    this.animateTurn('back', () => this.store.activePageIndex.set(index - 1));
  }

  private animateTurn(dir: 'forward' | 'back', flip: () => void): void {
    this.turning.set(dir);
    setTimeout(() => {
      flip();
      this.turning.set(null);
    }, 300);
  }
}
