export async function runListAlbumsCommand(deps: {
  listAlbums(): Promise<string[]>;
  writeLine(line: string): void;
}) {
  const albums = await deps.listAlbums();

  albums.forEach((album) => deps.writeLine(album));
}
