import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'events';
import sharp from 'sharp';
import { limitUploadConcurrency, removeUploadedImage, saveOptimizedImage } from '../src/middleware/upload.js';

function createResponse() {
  const res = new EventEmitter();
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = body => {
    res.body = body;
    return res;
  };
  return res;
}

test('bounds concurrent upload requests and releases capacity when responses close', () => {
  const first = createResponse();
  const second = createResponse();
  const rejected = createResponse();
  let nextCalls = 0;
  limitUploadConcurrency({}, first, () => { nextCalls++; });
  limitUploadConcurrency({}, second, () => { nextCalls++; });
  limitUploadConcurrency({}, rejected, () => { nextCalls++; });

  assert.equal(nextCalls, 2);
  assert.equal(rejected.statusCode, 503);
  assert.match(rejected.body.error, /capacity/);

  first.emit('close');
  const retry = createResponse();
  limitUploadConcurrency({}, retry, () => { nextCalls++; });
  assert.equal(nextCalls, 3);
  retry.emit('finish');
  second.emit('finish');
});

test('validates image data and saves only optimized WebP files', async () => {
  const png = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  }).png().toBuffer();

  const image = await saveOptimizedImage(png);
  try {
    assert.match(image.filename, /^[0-9a-f-]+\.webp$/);
    assert.equal(image.url, `/uploads/${image.filename}`);
    const outputPath = fileURLToPath(new URL(`../uploads/${image.filename}`, import.meta.url));
    const output = await readFile(outputPath);
    assert.equal(output.toString('ascii', 0, 4), 'RIFF');
    assert.equal(output.toString('ascii', 8, 12), 'WEBP');
  } finally {
    await removeUploadedImage(image.filename);
  }
});

test('rejects invalid image bytes', async () => {
  await assert.rejects(
    saveOptimizedImage(Buffer.from('not an image')),
    error => error.status === 400 && /valid supported image/.test(error.message)
  );
});
