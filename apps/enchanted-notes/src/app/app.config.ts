import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideQuillInk } from '@codewithahsan/ngx-quill-ink';
import { caveat } from '@codewithahsan/quill-ink-fonts/caveat';
import { dancingScript } from '@codewithahsan/quill-ink-fonts/dancing-script';
import { shadowsIntoLight } from '@codewithahsan/quill-ink-fonts/shadows-into-light';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
    provideQuillInk({
      font: 'caveat',
      inkColor: '#1a2b4a',
      paper: 'none',
      packs: [caveat, dancingScript, shadowsIntoLight],
    }),
  ],
};
