import type { SyncRequest, SyncResult } from "../../core/types.js";

export interface ImageSource {
  listAlbums(): Promise<string[]>;
  syncNewImages(request?: SyncRequest): Promise<SyncResult>;
}
