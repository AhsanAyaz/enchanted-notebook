import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotebookStore } from '../data/notebook.store';

@Component({
  selector: 'en-talk-list',
  imports: [FormsModule],
  templateUrl: './talk-list.component.html',
  styleUrl: './talk-list.component.scss',
})
export class TalkListComponent implements OnInit {
  readonly store = inject(NotebookStore);
  private readonly router = inject(Router);

  readonly creating = signal(false);
  title = '';
  targetMinutes: number | null = null;

  ngOnInit(): void {
    void this.store.loadNotebooks();
  }

  async create(): Promise<void> {
    const title = this.title.trim();
    if (!title) return;
    this.creating.set(true);
    try {
      const notebook = await this.store.createNotebook(
        title,
        this.targetMinutes,
      );
      await this.router.navigate(['/notebook', notebook.id]);
    } finally {
      this.creating.set(false);
    }
  }

  open(id: string): void {
    void this.router.navigate(['/notebook', id]);
  }

  async remove(event: Event, id: string): Promise<void> {
    event.stopPropagation();
    if (!confirm('Burn this notebook? Its pages are gone forever.')) return;
    await this.store.deleteNotebook(id);
  }
}
