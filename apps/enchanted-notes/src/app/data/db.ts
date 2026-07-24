import Dexie, { Table } from 'dexie';
import type { Notebook, Page, Turn } from '@enchanted/notes-domain';

/** Turn as stored locally. Transcript-only: no ink blobs are kept. */
export type LocalTurn = Turn;

export class EnchantedDb extends Dexie {
  notebooks!: Table<Notebook, string>;
  pages!: Table<Page, string>;
  turns!: Table<LocalTurn, string>;

  constructor() {
    super('enchanted-notes');
    this.version(1).stores({
      notebooks: 'id',
      pages: 'id, notebookId, [notebookId+index]',
      turns: 'id, pageId, [pageId+seq]',
    });
    // v2: transcript-only storage — drop cached ink PNGs, backfill beatText.
    this.version(2)
      .stores({
        notebooks: 'id',
        pages: 'id, notebookId, [notebookId+index]',
        turns: 'id, pageId, [pageId+seq]',
      })
      .upgrade((tx) =>
        tx
          .table('turns')
          .toCollection()
          .modify((t) => {
            delete t.pngBlob;
            t.beatText ??= t.transcript;
            t.rewriteAccepted ??= false;
          }),
      );
  }
}

export const db = new EnchantedDb();
