export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(left: string, right: string): number {
  if (!left) return right.length;
  if (!right) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value}  `;
  const result = new Set<string>();
  for (let index = 0; index <= padded.length - 3; index += 1) result.add(padded.slice(index, index + 3));
  return result;
}

function dice(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return a.size + b.size ? (2 * overlap) / (a.size + b.size) : 0;
}

export function similarity(input: string, candidate: string): number {
  const left = normalizeSearchText(input);
  const right = normalizeSearchText(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (right.startsWith(left) || left.startsWith(right)) return 0.94;
  if (right.includes(left) || left.includes(right)) return 0.9;
  const edit = 1 - levenshtein(left, right) / Math.max(left.length, right.length);
  return Math.max(0, Math.min(0.89, (edit * 0.55) + (dice(left, right) * 0.45)));
}

export function suggestions(input: string, candidates: readonly string[], limit = 3): string[] {
  return [...new Set(candidates)]
    .map((candidate) => ({ candidate, score: similarity(input, candidate) }))
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
