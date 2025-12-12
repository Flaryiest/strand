import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ExtractedPageContent {
  url: string;
  fetchedAt: string;
  title?: string;
  byline?: string;
  excerpt?: string;
  text?: string;
  charCount?: number;
  excerpts?: string[];
  extractionMethod: 'readability' | 'fallback';
}

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','are','was','were','you','your','but','not','have','has','had','they','their','them','its','it\'s','into','about','over','under','than','then','there','here','what','when','where','who','why','how','can','could','should','would','will','just','also','been','being','as','at','by','in','on','to','of','or','an','a','is','be'
]);

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripStylesheets(html: string): string {
  // jsdom will attempt to parse CSS inside <style> blocks and can throw on some modern sites.
  // We don't need CSS for readability extraction, so remove stylesheet sources proactively.
  return html
    // Remove <style> blocks.
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    // Remove <link rel="stylesheet" ...> and similar.
    .replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, ' ')
    // Remove preload/prefetch CSS links.
    .replace(/<link\b[^>]*as=["']?style["']?[^>]*>/gi, ' ');
}

function splitSentences(text: string): string[] {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  if (!cleaned) return [];

  // Simple sentence split heuristic.
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function keywordsFromQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map(w => w.trim())
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

function buildExcerpts(text: string, query: string, maxSentences: number): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const keywords = keywordsFromQuery(query);
  if (keywords.length === 0) {
    return sentences.slice(0, Math.min(maxSentences, 3));
  }

  const scored = sentences.map((sentence, idx) => {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    // Prefer reasonably sized sentences.
    if (sentence.length >= 40 && sentence.length <= 220) score += 0.5;
    return { idx, score, sentence };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored
    .filter(s => s.score > 0)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map(s => s.sentence);

  return picked.length > 0 ? picked : sentences.slice(0, Math.min(maxSentences, 3));
}

export function extractReadableContentFromHtml(
  url: string,
  html: string,
  queryForExcerpts?: string,
  options?: { maxChars?: number; maxExcerptSentences?: number }
): ExtractedPageContent {
  const maxChars = options?.maxChars ?? 6_000;
  const maxExcerptSentences = options?.maxExcerptSentences ?? 5;

  const fetchedAt = new Date().toISOString();

  try {
    const cleanedHtml = stripStylesheets(html);
    const dom = new JSDOM(cleanedHtml, { url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();

    const rawText = parsed?.textContent ? normalizeWhitespace(parsed.textContent) : '';
    const text = rawText ? rawText.slice(0, maxChars) : undefined;

    const excerpts = queryForExcerpts && rawText
      ? buildExcerpts(rawText, queryForExcerpts, maxExcerptSentences)
      : undefined;

    return {
      url,
      fetchedAt,
      title: parsed?.title || undefined,
      byline: parsed?.byline || undefined,
      excerpt: parsed?.excerpt ? normalizeWhitespace(parsed.excerpt) : undefined,
      text,
      charCount: rawText ? rawText.length : 0,
      excerpts,
      extractionMethod: 'readability'
    };
  } catch {
    // Fallback: strip tags very roughly.
    const textOnly = normalizeWhitespace(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    );

    const text = textOnly ? textOnly.slice(0, maxChars) : undefined;
    const excerpts = queryForExcerpts && textOnly
      ? buildExcerpts(textOnly, queryForExcerpts, maxExcerptSentences)
      : undefined;

    return {
      url,
      fetchedAt,
      text,
      charCount: textOnly.length,
      excerpts,
      extractionMethod: 'fallback'
    };
  }
}
