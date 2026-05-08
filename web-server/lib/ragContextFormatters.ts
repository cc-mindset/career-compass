import { RagRetrievalResponse, RagNamespace, PineconeMatch, FormattedRagContext } from '../types/rag.js';

export function formatMarketInsightsContext(response: RagRetrievalResponse): FormattedRagContext {
  const blocks: string[] = [];
  const sourcesByNamespace: Record<string, { id: string; source: string }[]> = {};
  let matchCount = 0;

  for (const [ns, matches] of Object.entries(response.results || {})) {
    if (!matches || matches.length === 0) continue; // skip empty namespaces

    const header = `[${ns}]`;
    const lines: string[] = [];
    sourcesByNamespace[ns] = [];

    for (const m of matches as PineconeMatch[]) {
      const meta = m.metadata || {};
      const source = (meta['source'] || meta['publisher'] || '') as string;
      const title = (meta['title'] || '') as string;
      const publishedAt = (meta['published_at'] || meta['date'] || '') as string;
      const text = m.text || '';

      const metaLineParts = [`Source: ${source || 'Unknown'}`, `Title: ${title || 'Untitled'}`];
      if (publishedAt) metaLineParts.push(`Date: ${publishedAt}`);
      const metaLine = metaLineParts.join(' | ');

      lines.push(`${metaLine}\n${text}`);

      sourcesByNamespace[ns].push({ id: m.id, source: source || '' });
      matchCount += 1;
    }

    blocks.push(header);
    blocks.push(lines.join('\n\n'));
  }

  const text = blocks.join('\n\n');

  return {
    text,
    sourcesByNamespace,
    matchCount,
  } as FormattedRagContext;
}
