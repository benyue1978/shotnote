import type { ImageSource } from "../adapters/photo-source/photo-source.js";
import type { HashState, SyncMode, SyncRequest, SyncSummary } from "../core/types.js";

type SyncServiceOptions = {
  source: ImageSource;
  syncedStateStore: {
    read(): Promise<HashState>;
    write(state: HashState): Promise<void>;
  };
  now?: () => string;
};

export class SyncExecutionError extends Error {
  syncMode: SyncMode;
  effectiveRequest?: SyncRequest;

  constructor(message: string, options: { syncMode: SyncMode; effectiveRequest?: SyncRequest; cause?: unknown }) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "SyncExecutionError";
    this.syncMode = options.syncMode;
    this.effectiveRequest = options.effectiveRequest;
  }
}

export function createSyncService(options: SyncServiceOptions) {
  return {
    async listAlbums() {
      return options.source.listAlbums();
    },
    async sync(request?: SyncRequest): Promise<SyncSummary> {
      const state = await options.syncedStateStore.read();
      const effectiveRequest = buildSourceSyncRequest(state, request);
      const syncMode: SyncMode = effectiveRequest?.since ? "incremental" : "initial";
      let sourceResult;

      try {
        sourceResult = await options.source.syncNewImages(effectiveRequest);
      } catch (error) {
        throw new SyncExecutionError(error instanceof Error ? error.message : String(error), {
          syncMode,
          effectiveRequest,
          cause: error
        });
      }

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
        discoveredCount: sourceResult.discoveredCount,
        sourceSkippedCount: sourceResult.skippedCount,
        newCount,
        duplicateCount,
        syncMode,
        effectiveRequest
      };
    }
  };
}

function buildSourceSyncRequest(state: HashState, request?: SyncRequest): SyncRequest | undefined {
  const latestDiscoveredAt = getLatestPreciseDiscoveredAt(state);
  const latestSyncedAt = getLatestSyncedAt(state);

  if (latestDiscoveredAt) {
    return {
      since: latestDiscoveredAt
    };
  }

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

function getLatestPreciseDiscoveredAt(state: HashState) {
  return Object.values(state.byHash).reduce<string | undefined>((latest, record) => {
    const watermark = record.discoveredAt;

    if (!watermark || !isPreciseTimestamp(watermark)) {
      return latest;
    }

    if (!latest || watermark > latest) {
      return watermark;
    }

    return latest;
  }, undefined);
}

function getLatestSyncedAt(state: HashState) {
  return Object.values(state.byHash).reduce<string | undefined>((latest, record) => {
    const watermark = record.syncedAt;

    if (!watermark) {
      return latest;
    }

    if (!latest || watermark > latest) {
      return watermark;
    }

    return latest;
  }, undefined);
}

function isPreciseTimestamp(value: string) {
  return value.includes("T");
}
