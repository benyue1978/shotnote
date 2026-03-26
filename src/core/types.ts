export type ScreenshotType =
  | "tool"
  | "website"
  | "git-repo"
  | "concept"
  | "article"
  | "other";

export type SourceConfig = {
  type: "photos-album";
  albumName: string;
};

export type AnalysisConfig = {
  provider: "openai";
  model: string;
  promptPath: string;
  openAIApiKey?: string;
};

export type AppPaths = {
  root: string;
  inbox: string;
  notes: string;
  prompts: string;
  bin: string;
  prompt: string;
  state: string;
  syncedState: string;
  analyzedState: string;
  logs: string;
  config: string;
};

export type ShotnoteConfig = {
  paths: AppPaths;
  source: SourceConfig;
  analysis: AnalysisConfig;
};

export type ScreenshotAnalysis = {
  type: ScreenshotType;
  title: string;
  summary: string;
  whyInteresting: string;
  entities: string[];
  tags: string[];
};

export type MarkdownNoteInput = {
  analysis: ScreenshotAnalysis;
  sourceImagePath: string;
  analyzedAt: string;
  model: string;
  raw: unknown;
  warnings?: string[];
};

export type StateRecord = Record<string, string>;

export type HashStateRecord = {
  imagePath: string;
  discoveredAt?: string;
  syncedAt?: string;
  analyzedAt?: string;
  source?: string;
  notePath?: string;
  model?: string;
};

export type HashState = {
  byHash: Record<string, HashStateRecord>;
};

export type SyncedImage = {
  originalPath: string;
  imagePath: string;
  hash: string;
  discoveredAt?: string;
};

export type SyncResult = {
  discoveredCount: number;
  exported: SyncedImage[];
  skippedCount: number;
  warnings: string[];
};

export type SyncMode = "initial" | "incremental";

export type SyncSummary = {
  discoveredCount: number;
  sourceSkippedCount: number;
  newCount: number;
  duplicateCount: number;
  syncMode: SyncMode;
  effectiveRequest?: SyncRequest;
};

export type SyncRequest = {
  limit?: number;
  since?: string;
};

export type AnalyzeInput = {
  imagePath: string;
  prompt: string;
};

export type AnalyzeResult = {
  analysis: ScreenshotAnalysis;
  raw: unknown;
  warnings: string[];
  model: string;
};

export type AnalyzeRequest = {
  imageName?: string;
  force?: boolean;
};

export type ResolveConfigOptions = {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  flags?: Partial<{
    albumName: string;
    model: string;
    promptPath: string;
  }>;
};
