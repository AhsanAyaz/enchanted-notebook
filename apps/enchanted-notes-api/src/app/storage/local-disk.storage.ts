import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { StorageService } from './storage.service';

export const LOCAL_STORAGE_ROOT = join(
  process.cwd(),
  'apps/enchanted-notes-api/storage',
);

@Injectable()
export class LocalDiskStorage extends StorageService {
  override async put(key: string, data: Buffer): Promise<string> {
    const filePath = join(LOCAL_STORAGE_ROOT, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return `/files/${key}`;
  }
}
