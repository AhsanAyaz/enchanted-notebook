import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./talk-list/talk-list.component').then(
        (m) => m.TalkListComponent,
      ),
  },
  {
    path: 'notebook/:id',
    loadComponent: () =>
      import('./notebook/notebook.component').then(
        (m) => m.NotebookComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
