export type SyncEvent = {
  at: string;
  matchId: string;
  kind: 'offline' | 'restored' | 'conflict';
};
export function readSyncLog(value: string | null): SyncEvent[] {
  try {
    const rows: unknown = JSON.parse(value ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (x): x is SyncEvent =>
          !!x &&
          typeof x === 'object' &&
          typeof x.at === 'string' &&
          Number.isFinite(Date.parse(x.at)) &&
          typeof x.matchId === 'string' &&
          x.matchId.length <= 100 &&
          ['offline', 'restored', 'conflict'].includes(x.kind),
      )
      .slice(-100)
      .map(({ at, matchId, kind }) => ({ at, matchId, kind }));
  } catch {
    return [];
  }
}
export function appendSyncLog(
  rows: SyncEvent[],
  event: SyncEvent,
): SyncEvent[] {
  const last = rows.at(-1);
  if (
    event.kind !== 'conflict' &&
    last?.kind === event.kind &&
    last.matchId === event.matchId
  )
    return rows;
  return [...rows, event].slice(-100);
}
