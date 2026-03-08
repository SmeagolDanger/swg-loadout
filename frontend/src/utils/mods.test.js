import test from 'node:test';
import assert from 'node:assert/strict';

import { downloadZipName, formatBytes, slugifyModTitle, splitModTags } from './mods.js';

test('slugifyModTitle normalizes titles', () => {
  assert.equal(slugifyModTitle('My Cool UI Mod!!'), 'my-cool-ui-mod');
});

test('splitModTags splits and trims tags', () => {
  assert.deepEqual(splitModTags('ui, icons,  quality of life '), ['ui', 'icons', 'quality of life']);
});

test('formatBytes formats kilobytes', () => {
  assert.equal(formatBytes(2048), '2.0 KB');
});

test('downloadZipName builds filename', () => {
  assert.equal(downloadZipName({ title: 'My Mod', version: '1.2.3' }), 'my-mod-1.2.3.zip');
});
