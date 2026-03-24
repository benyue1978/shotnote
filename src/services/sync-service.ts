import type { ImageSource } from "../adapters/photo-source/photo-source.js";
import type { HashState, SyncRequest } from "../core/types.js";

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
    async sync(request?: SyncRequest) {
      const state = await options.syncedStateStore.read();
      const sourceResult = await options.source.syncNewImages(buildSourceSyncRequest(state, request));
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
          discoveredAt: item.discoveredAt,
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

function buildSourceSyncRequest(state: HashState, request?: SyncRequest): SyncRequest | undefined {
  const latestSyncedAt = getLatestSyncedAt(state);

  if (latestSyncedAt) {
    return {
      since: latestSyncedAt
    };
  }

  if (request?.limit) {
    return {
      limit: request.limit
    };
  }

  return undefined;
}

function getLatestSyncedAt(state: HashState) {
  return Object.values(state.byHash).reduce<string | undefined>((latest, record) => {
    if (!record.syncedAt) {
      return latest;
    }

    if (!latest || record.syncedAt > latest) {
      return record.syncedAt;
    }

    return latest;
  }, undefined);
}
