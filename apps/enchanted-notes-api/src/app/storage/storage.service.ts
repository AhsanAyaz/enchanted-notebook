export abstract class StorageService {
  /** Store a blob and return its public URL path. */
  abstract put(key: string, data: Buffer, mimeType: string): Promise<string>;
}
