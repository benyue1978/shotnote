import type { ImageSource } from "../adapters/photo-source/photo-source.js";
import type { HashState, SyncResult } from "../core/types.js";

type SyncServiceOptions = {
  source: ImageSource;
  syncedStateStore: {
    read(): Promise<HashState>;
    write(state: HashState): Promise<void>;
  };
  now?: () => string;
};

export function createSyncService(options: SyncServiceOptions) {
  return {
    async listAlbums() {
      return options.source.listAlbums();
    },
    async sync() {
      const state = await options.syncedStateStore.read();
      const sourceResult = await options.source.syncNewImages();
      const syncedAt = options.now?.() ?? new Date().toISOString();
      let newCount = 0;
      let duplicateCount = 0;

      for (const item of sourceResult.exported) {
        if (state.byHash[item.hash]) {
          duplicateCount += 1;
          continue;
        }

        state.byHash[item.hash] = {
          imagePath: item.imagePath,
          syncedAt,
          source: "photos-album"
        };
        newCount += 1;
      }

      await options.syncedStateStore.write(state);

      return {
        ...sourceResult,
        newCount,
        duplicateCount
      };
    }
  };
}
