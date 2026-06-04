import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  collectStyleguideData,
  generateStyleguideData,
  parseStyleguideComments,
} from '../src/index.js';

const execFileAsync = promisify(execFile);
const currentDir = path.dirname(fileURLToPath(import.meta.url));

const fixtureCss = `/*
* @sg-category Component
* @sg-name CTA
* @sg-description CTA component.
* @sg-table
* | Class | Description |
* |-------|-------------|
* | c-cta | Container |
* @sg-example
<div class="c-cta" style="color: red;">
  CTA
</div>
*/

.c-cta {
  display: block;
}
`;

const advancedFixtureCss = `/*
* @sg-category Component
* @sg-name Card
* @sg-description Card component.
* @sg-variant compact
* @sg-table
* | Class | Description |
* |-------|-------------|
* | c-card | Container |
* @sg-markup default
<article class="c-card">Markup</article>
* @sg-example default
<article class="c-card">Example</article>
* @sg-sub-name Image
* @sg-description Image area.
* @sg-variant square
* @sg-example image
<div class="c-card__image">Image</div>
*/
`;

test('parseStyleguideComments extracts component data', () => {
  const parsed = parseStyleguideComments(fixtureCss);

  assert.equal(parsed.Component.length, 1);
  assert.equal(parsed.Component[0].name, 'CTA');
  assert.equal(parsed.Component[0].id, 'cta');
  assert.equal(parsed.Component[0].description, 'CTA component.');
  assert.equal(parsed.Component[0].tables[0].includes('c-cta'), true);
  assert.equal(parsed.Component[0].examples[0].name, 'default');
  assert.equal(parsed.Component[0].examples[0].code.includes('style='), false);
});

test('parseStyleguideComments supports markup, variants and sub components', () => {
  const parsed = parseStyleguideComments(advancedFixtureCss);
  const component = parsed.Component[0];

  assert.equal(component.name, 'Card');
  assert.deepEqual(component.variants, ['compact']);
  assert.equal(component.markup[0].name, 'default');
  assert.equal(
    component.markup[0].code,
    '<article class="c-card">Markup</article>',
  );
  assert.equal(component.children[0].subName, 'Image');
  assert.deepEqual(component.children[0].variants, ['square']);
  assert.equal(component.children[0].examples[0].name, 'image');
});

test('parseStyleguideComments can include source and warnings', () => {
  const warnings = [];
  const parsed = parseStyleguideComments(
    `/*\n* @sg-name Alert\n* @sg-example\n*/`,
    {
      filePath: 'src/alert.css',
      includeSource: true,
      warnings,
    },
  );

  assert.equal(parsed.default[0].source.file, 'src/alert.css');
  assert.equal(parsed.default[0].source.line, 1);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].source.file, 'src/alert.css');
  assert.equal(
    warnings.some((warning) => warning.message.includes('@sg-category')),
    true,
  );
  assert.equal(
    warnings.some((warning) => warning.message.includes('@sg-example')),
    true,
  );
});

test('collectStyleguideData reads CSS files from glob', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-data-'));
  const cssDir = path.join(tmpDir, 'src/assets/css/component/cta');
  await fs.mkdir(cssDir, { recursive: true });
  await fs.writeFile(path.join(cssDir, 'cta.css'), fixtureCss);

  const result = await collectStyleguideData({
    cwd: tmpDir,
    input: 'src/assets/css/**/*.css',
  });

  assert.deepEqual(result.files, ['src/assets/css/component/cta/cta.css']);
  assert.equal(result.categories.Component[0].name, 'CTA');
});

test('generateStyleguideData writes category JSON files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-data-'));
  const cssDir = path.join(tmpDir, 'src/assets/css/component/cta');
  await fs.mkdir(cssDir, { recursive: true });
  await fs.writeFile(path.join(cssDir, 'cta.css'), fixtureCss);

  const result = await generateStyleguideData({
    cwd: tmpDir,
    input: 'src/assets/css/**/*.css',
    output: 'src/_data',
    prefix: 'styleguide',
  });
  const outputPath = path.join(tmpDir, 'src/_data/styleguidecomponent.json');
  const output = JSON.parse(await fs.readFile(outputPath, 'utf8'));

  assert.equal(result.outputFiles.length, 1);
  assert.equal(output[0].name, 'CTA');
});

test('CLI can load options from a config file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-data-'));
  const cssDir = path.join(tmpDir, 'styles');
  await fs.mkdir(cssDir, { recursive: true });
  await fs.writeFile(path.join(cssDir, 'card.css'), advancedFixtureCss);
  await fs.writeFile(
    path.join(tmpDir, 'css-comments-to-json.config.mjs'),
    `export default {
      input: 'styles/**/*.css',
      output: 'data',
      prefix: 'docs',
    };`,
  );

  const cliPath = path.resolve(currentDir, '../src/cli.js');
  const { stdout } = await execFileAsync('node', [
    cliPath,
    '--config',
    'css-comments-to-json.config.mjs',
    '--cwd',
    tmpDir,
  ]);
  const output = JSON.parse(
    await fs.readFile(path.join(tmpDir, 'data/docscomponent.json'), 'utf8'),
  );

  assert.equal(output[0].name, 'Card');
  assert.match(stdout, /generated 1 files/);
});
