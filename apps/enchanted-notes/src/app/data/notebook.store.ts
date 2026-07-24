import { computed, Injectable, signal } from '@angular/core';
import { SPEAKING_WPM } from '@enchanted/notes-domain';
import type { Notebook, Page } from '@enchanted/notes-domain';
import { db, LocalTurn } from './db';
import { patchTurn } from './turns.api';

interface NotebookDetail extends Notebook {
  pages: Array<Page & { turns: LocalTurn[] }>;
}

/**
 * Signals-based store. Server is the source of record; Dexie is the local
 * write-through cache so the notebook opens instantly (and offline for
 * reading). Turn queueing/sync is a later pass.
 */
@Injectable({ providedIn: 'root' })
export class NotebookStore {
  readonly notebooks = signal<Notebook[]>([]);
  readonly activeNotebook = signal<Notebook | null>(null);
  readonly pages = signal<Page[]>([]);
  readonly activePageIndex = signal(0);
  readonly turnsByPage = signal<Record<string, LocalTurn[]>>({});

  readonly activePage = computed(
    () => this.pages()[this.activePageIndex()] ?? null,
  );
  readonly activePageTurns = computed(() => {
    const page = this.activePage();
    return page ? this.turnsByPage()[page.id] ?? [] : [];
  });

  /** Running speaking-time estimate across the whole notebook. */
  readonly totalMinutes = computed(() => {
    const words = Object.values(this.turnsByPage())
      .flat()
      .map((t) => (t.beatText ?? t.transcript).trim().split(/\s+/).length)
      .reduce((a, b) => a + b, 0);
    return words ? Math.max(1, Math.round(words / SPEAKING_WPM)) : 0;
  });

  async loadNotebooks(): Promise<void> {
    // hydrate from Dexie first for instant paint
    this.notebooks.set(await db.notebooks.toArray());
    try {
      const fresh: Notebook[] = await (await fetch('/api/notebooks')).json();
      this.notebooks.set(fresh);
      await db.notebooks.clear();
      await db.notebooks.bulkPut(fresh);
    } catch {
      // offline — Dexie copy stands
    }
  }

  async createNotebook(
    title: string,
    targetMinutes: number | null,
  ): Promise<Notebook> {
    const res = await fetch('/api/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, targetMinutes }),
    });
    if (!res.ok) throw new Error('failed to create notebook');
    const notebook: Notebook & { pages: Page[] } = await res.json();
    await db.notebooks.put(notebook);
    await db.pages.bulkPut(notebook.pages);
    this.notebooks.update((list) => [notebook, ...list]);
    return notebook;
  }

  async deleteNotebook(id: string): Promise<void> {
    await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
    const pageIds = (await db.pages.where({ notebookId: id }).toArray()).map(
      (p) => p.id,
    );
    await db.turns.where('pageId').anyOf(pageIds).delete();
    await db.pages.where({ notebookId: id }).delete();
    await db.notebooks.delete(id);
    this.notebooks.update((list) => list.filter((n) => n.id !== id));
  }

  async openNotebook(id: string): Promise<void> {
    this.activePageIndex.set(0);
    // Dexie-first paint
    const cached = await db.notebooks.get(id);
    if (cached) {
      this.activeNotebook.set(cached);
      const pages = await db.pages
        .where({ notebookId: id })
        .sortBy('index');
      this.pages.set(pages);
      const byPage: Record<string, LocalTurn[]> = {};
      for (const p of pages) {
        byPage[p.id] = await db.turns.where({ pageId: p.id }).sortBy('seq');
      }
      this.turnsByPage.set(byPage);
    }
    try {
      const detail: NotebookDetail = await (
        await fetch(`/api/notebooks/${id}`)
      ).json();
      this.activeNotebook.set(detail);
      this.pages.set(detail.pages.map(({ turns, ...page }) => page));
      const byPage: Record<string, LocalTurn[]> = {};
      for (const p of detail.pages) {
        byPage[p.id] = p.turns;
        await db.pages.put({
          id: p.id,
          notebookId: p.notebookId,
          index: p.index,
        });
        await db.turns.bulkPut(byPage[p.id]);
      }
      this.turnsByPage.set(byPage);
      await db.notebooks.put({
        id: detail.id,
        userId: detail.userId,
        title: detail.title,
        targetMinutes: detail.targetMinutes,
        createdAt: detail.createdAt,
      });
    } catch {
      // offline — cached copy stands
    }
  }

  async addPage(): Promise<Page | null> {
    const notebook = this.activeNotebook();
    if (!notebook) return null;
    const res = await fetch(`/api/notebooks/${notebook.id}/pages`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    const page: Page = await res.json();
    await db.pages.put(page);
    this.pages.update((list) => [...list, page]);
    return page;
  }

  /** Accept or restore a rewrite: optimistic local update, then PATCH; revert on failure. */
  async updateTurnBeat(
    turn: LocalTurn,
    beatText: string,
    rewriteAccepted = true,
  ): Promise<void> {
    const updated: LocalTurn = { ...turn, beatText, rewriteAccepted };
    this.replaceTurn(updated);
    await db.turns.put(updated);
    try {
      await patchTurn(turn.id, { beatText, rewriteAccepted });
    } catch (err) {
      console.warn('rewrite not saved to server, reverting', err);
      this.replaceTurn(turn);
      await db.turns.put(turn);
    }
  }

  async deleteTurn(turn: LocalTurn): Promise<void> {
    this.turnsByPage.update((byPage) => ({
      ...byPage,
      [turn.pageId]: (byPage[turn.pageId] ?? []).filter(
        (t) => t.id !== turn.id,
      ),
    }));
    await db.turns.delete(turn.id);
    try {
      await fetch(`/api/turns/${turn.id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('turn delete not synced to server', err);
    }
  }

  private replaceTurn(turn: LocalTurn): void {
    this.turnsByPage.update((byPage) => ({
      ...byPage,
      [turn.pageId]: (byPage[turn.pageId] ?? []).map((t) =>
        t.id === turn.id ? turn : t,
      ),
    }));
  }

  /** Tear out the active page. Returns false when it's the only page. */
  async deleteActivePage(): Promise<boolean> {
    const notebook = this.activeNotebook();
    const page = this.activePage();
    if (!notebook || !page || this.pages().length <= 1) return false;
    const res = await fetch(
      `/api/notebooks/${notebook.id}/pages/${page.id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) return false;
    await db.turns.where({ pageId: page.id }).delete();
    await db.pages.delete(page.id);
    this.turnsByPage.update((byPage) => {
      const next = { ...byPage };
      delete next[page.id];
      return next;
    });
    this.pages.update((list) => list.filter((p) => p.id !== page.id));
    this.activePageIndex.update((i) => Math.max(0, i - 1));
    return true;
  }

  async recordTurn(turn: LocalTurn): Promise<void> {
    await db.turns.put(turn);
    this.turnsByPage.update((byPage) => ({
      ...byPage,
      [turn.pageId]: [...(byPage[turn.pageId] ?? []), turn].sort(
        (a, b) => a.seq - b.seq,
      ),
    }));
  }
}
