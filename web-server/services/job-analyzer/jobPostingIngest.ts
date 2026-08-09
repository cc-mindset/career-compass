import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

/** Extract plain text from an uploaded job posting document. */
export async function extractJobPostingText(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
): Promise<string> {
  const lowerName = (fileName || '').toLowerCase();
  const isPdf =
    mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
  const isDocx =
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx');
  const isTxt =
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md');

  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || '';
  }
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  if (isTxt) {
    return buffer.toString('utf8');
  }

  throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.');
}

/**
 * Best-effort fetch of a public job URL. Returns failure messaging for paste fallback.
 */
export async function fetchJobPostingFromUrl(
  url: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      error: 'Invalid URL. Paste the job description instead.',
    };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      ok: false,
      error: 'Only http(s) URLs are supported. Paste the job description instead.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ClarityCoachJobAnalyzer/1.0',
        Accept: 'text/html,text/plain,*/*',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        ok: false,
        error: `Could not fetch that URL (${response.status}). Paste the job description instead.`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (!body.trim()) {
      return {
        ok: false,
        error: 'The URL returned empty content. Paste the job description instead.',
      };
    }

    let text = body;
    if (contentType.includes('html')) {
      text = body
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (text.length < 40) {
      return {
        ok: false,
        error:
          'Could not extract a usable posting from that URL. Paste the job description instead.',
      };
    }

    return { ok: true, text: text.slice(0, 80_000) };
  } catch {
    return {
      ok: false,
      error:
        'URL fetch failed or was blocked. Paste the job description instead.',
    };
  }
}
