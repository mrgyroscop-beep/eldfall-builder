// Stable non-security fingerprint: detects source drift without shipping node:crypto.
export function sourceFingerprint(value: unknown): string {
  function stable(x: unknown): string {
    if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
    if (x && typeof x === 'object')
      return `{${Object.keys(x)
        .sort()
        .map(
          (k) =>
            `${JSON.stringify(k)}:${stable((x as Record<string, unknown>)[k])}`,
        )
        .join(',')}}`;
    return JSON.stringify(x) ?? 'null';
  }
  let hash = 2166136261;
  for (const char of stable(value))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
