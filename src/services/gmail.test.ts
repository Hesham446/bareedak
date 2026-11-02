import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeBase64UrlToBytes,
  parseAddressHeader,
  formatFileSize,
} from './gmail';

test('decodeBase64UrlToBytes decodes URL-safe base64 and missing padding', () => {
  const encoded = Buffer.from('Hello, Gmail!').toString('base64url').replace(/=/g, '');
  const decoded = new TextDecoder().decode(decodeBase64UrlToBytes(encoded));

  assert.equal(decoded, 'Hello, Gmail!');
});

test('parseAddressHeader extracts a display name and address', () => {
  assert.deepEqual(parseAddressHeader('"Jane Doe" <jane@example.com>'), {
    name: 'Jane Doe',
    email: 'jane@example.com',
    raw: '"Jane Doe" <jane@example.com>',
  });
});

test('parseAddressHeader handles a bare email address', () => {
  assert.deepEqual(parseAddressHeader('jane@example.com'), {
    name: 'jane@example.com',
    email: 'jane@example.com',
    raw: 'jane@example.com',
  });
});

test('formatFileSize uses readable units and handles empty sizes', () => {
  assert.equal(formatFileSize(0), '0 KB');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
});
