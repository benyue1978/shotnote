import type { SyncResult } from "../../core/types.js";

export interface ImageSource {
  listAlbums(): Promise<string[]>;
  syncNewImages(): Promise<SyncResult>;
}
