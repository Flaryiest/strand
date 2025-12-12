import test from 'node:test';
import assert from 'node:assert/strict';

import { extractReadableContentFromHtml } from '../dist/services/utils/pageContent.js';

test('extractReadableContentFromHtml strips stylesheets to avoid css parse crashes', () => {
  const html = `<!doctype html>
<html>
<head>
  <title>Example</title>
  <style>
    /* intentionally gnarly css that can break parsers */
    :root{--x:1} .a{content: "\\"} @media (prefers-color-scheme:dark){.b{}}
  </style>
  <link rel="stylesheet" href="https://example.com/styles.css" />
</head>
<body>
  <article>
    <h1>Hello World</h1>
    <p>This is a test article about ramen in SF.</p>
    <p>Another paragraph with useful context for ramen lovers.</p>
  </article>
</body>
</html>`;

  const out = extractReadableContentFromHtml('https://example.com/post', html, 'best ramen sf', {
    maxChars: 2000,
    maxExcerptSentences: 5
  });

  assert.equal(out.url, 'https://example.com/post');
  assert.ok(out.fetchedAt);
  assert.ok(out.text && out.text.length > 0);
  assert.ok(out.charCount >= (out.text?.length ?? 0));
  // Excerpts should exist for query.
  assert.ok(Array.isArray(out.excerpts));
});
