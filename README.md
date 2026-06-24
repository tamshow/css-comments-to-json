# css-comments-to-json

Generate styleguide JSON data from CSS comments.

[English](#english) / [日本語](#日本語)

## English

This package is inspired by Hologram and KSS. It parses documentation comments written close to your CSS components and turns them into structured styleguide data.

Unlike Hologram or many KSS-style tools, this package does not try to render a complete styleguide UI by itself. It focuses on generating JSON that can be consumed by Eleventy, Astro, VitePress, or any static site generator.

## Why

Storybook is a powerful component workshop, and it is often the right tool for application components with many states, props, interactions, and visual tests.

But not every project needs that much machinery. For static sites, CSS-first component libraries, Eleventy/Nunjucks projects, corporate websites, landing pages, and CMS-oriented builds, a full component workshop can be more than the project needs.

`css-comments-to-json` is for projects where you want:

- CSS comments to be the source of truth for component usage.
- Class tables, descriptions, variants, and HTML examples to live near the CSS.
- Structured JSON that your existing static site generator can render.
- A lightweight alternative when Storybook is more than you need.
- Documentation that is easy for both humans and AI coding agents to read.

The basic flow is:

```txt
CSS comments
  -> styleguide JSON
  -> your static site generator
```

In short: this is a lightweight styleguide data generator for CSS-first projects, not a replacement for Storybook.

## When To Use This

Use this when:

- You are building mostly static HTML/CSS sites.
- Your components are documented by class names and HTML examples.
- You already have an SSG such as Eleventy and want to render the styleguide there.
- You want Hologram/KSS-like CSS documentation without adopting a full UI workshop.
- You want AI tools to infer existing component usage from source-adjacent documentation.

## Install

```sh
npm install -D css-comments-to-json
```

## CLI

```sh
npx css-comments-to-json \
  --input "src/assets/css/**/*.css" \
  --output "src/_data" \
  --prefix styleguide
```

This writes files like:

```txt
src/_data/styleguidecomponent.json
src/_data/styleguidebase-component.json
```

## CSS Comment Format

```css
/*
* @sg-category Component
* @sg-name CTA
* @sg-description CTA component.
* @sg-table
* | Class | Description |
* |-------|-------------|
* | c-cta | CTA container |
* @sg-example
<div class="c-cta">
  CTA
</div>
*/
```

Supported tags:

- `@sg-category`
- `@sg-name`
- `@sg-sub-name`
- `@sg-description`
- `@sg-table`
- `@sg-example`
- `@sg-markup`
- `@sg-variant`

Format notes:

- Tags may also appear on the comment start line, e.g. `/* @sg-category Component`.
- `@sg-description` may continue over multiple lines. Continuation ends at a blank line or the next tag.
- Unknown `@sg-` tags (including typos) are reported as warnings and ignored.
- Non-ASCII names such as Japanese are kept in component `id` values and output filenames.

## JavaScript API

```js
import { generateStyleguideData } from 'css-comments-to-json';

await generateStyleguideData({
  input: 'src/assets/css/**/*.css',
  output: 'src/_data',
  prefix: 'styleguide',
});
```

For parsing a single CSS string:

```js
import { parseStyleguideComments } from 'css-comments-to-json';

const data = parseStyleguideComments(css);
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `input` | `src/assets/css/**/*.css` | CSS input glob |
| `output` | `src/_data` | Output directory |
| `prefix` | `styleguide` | Output filename prefix |
| `cwd` | `process.cwd()` | Working directory |
| `dryRun` | `false` | Return output files without writing |
| `includeSource` | `false` | Include source file and line |

## Config File

You can keep options in a JavaScript config file:

```js
// css-comments-to-json.config.mjs
export default {
  input: 'src/assets/css/**/*.css',
  output: 'src/_data',
  prefix: 'styleguide',
  includeSource: true,
};
```

Run it with:

```sh
npx css-comments-to-json --config css-comments-to-json.config.mjs
```

CLI flags override config file values.

## JSON Output

Each `@sg-category` becomes one JSON file. For example, `Component` with the
default `styleguide` prefix becomes `styleguidecomponent.json`.

```json
[
  {
    "name": "CTA",
    "id": "cta",
    "description": "CTA component.",
    "children": [],
    "tables": [
      "| Class | Description |\n|-------|-------------|\n| c-cta | CTA container |"
    ],
    "examples": [
      {
        "name": "default",
        "code": "<div class=\"c-cta\">\n  CTA\n</div>"
      }
    ]
  }
]
```

When `includeSource` is enabled, each component also includes `source.file` and
`source.line`.

## Warnings

The CLI prints warnings for incomplete styleguide comments, such as:

- Missing `@sg-category`
- Missing or empty `@sg-name`
- Empty `@sg-example`, `@sg-markup`, or `@sg-table` blocks
- `@sg-sub-name`, `@sg-example`, `@sg-markup`, or `@sg-table` before `@sg-name`
- Unknown `@sg-` tags (likely typos)
- No files matched the input glob
- Two categories resolving to the same output filename (e.g. `Base` and `base`)

With `--strict`, the CLI exits with code 1 when any warning is reported. This is useful in CI builds:

```sh
npx css-comments-to-json --input "src/assets/css/**/*.css" --strict
```

The JavaScript API returns the same warnings:

```js
const result = await generateStyleguideData({
  input: 'src/assets/css/**/*.css',
});

console.log(result.warnings);
```

## Notes

This package extracts `@sg-` tags from CSS-compatible block comments (`/* ... */`). It can also be used with SCSS or PostCSS source files as long as the comments use that format.

```sh
npx css-comments-to-json \
  --input "src/**/*.{css,scss,pcss}" \
  --output "src/_data" \
  --prefix styleguide
```

SCSS line comments such as `// @sg-name` are not parsed.

The parser is intentionally lightweight. It reports warnings for incomplete comment blocks, but it does not validate Markdown table syntax. Table content is passed through as text.

Custom project-specific tags are not supported yet. The current implementation supports the documented `@sg-` tags only.

## Eleventy

Use the CLI before Eleventy builds:

```json
{
  "scripts": {
    "build:css-comments-json": "css-comments-to-json --input \"src/assets/css/**/*.css\" --output \"src/_data\" --prefix styleguide",
    "build": "npm run build:css-comments-json && eleventy"
  }
}
```

## 日本語

`css-comments-to-json` は、CSS 内の構造化コメントを読み取り、JSON に変換する小さな CLI/API です。

Hologram や KSS のような「CSS コメントを実装に近い場所へ置く」思想に影響を受けています。ただし、このパッケージ自体は完全なスタイルガイド UI を生成しません。CSS コメントから JSON を生成し、その JSON を Eleventy、Astro、VitePress など任意の静的サイトジェネレータで表示することに特化しています。

### なぜ使うのか

Storybook は強力なコンポーネントワークショップです。状態、props、インタラクション、visual test が多いアプリケーションコンポーネントでは適した選択です。

一方で、すべてのプロジェクトに Storybook ほどの仕組みが必要とは限りません。静的サイト、CSS 中心のコンポーネント、Eleventy/Nunjucks、コーポレートサイト、LP、CMS 実装寄りの案件では、もう少し軽い仕組みの方が合うことがあります。

`css-comments-to-json` は、次のような場合に向いています。

- CSS コメントをコンポーネント利用方法の一次情報にしたい。
- class 一覧、説明、variant、HTML 例を CSS の近くに置きたい。
- 既存の静的サイトジェネレータでスタイルガイドを表示したい。
- Storybook までは不要だが、軽量なスタイルガイドデータは欲しい。
- 人間にも AI コーディングエージェントにも読みやすいコンポーネントドキュメントを作りたい。

基本の流れは次の通りです。

```txt
CSS コメント
  -> スタイルガイド用 JSON
  -> 任意の静的サイトジェネレータ
```

つまり、これは Storybook の代替ではなく、CSS-first なプロジェクト向けの軽量な JSON 生成ツールです。

### 向いているケース

向いているケース:

- 静的 HTML/CSS 中心のサイトを作っている。
- コンポーネントを class 名と HTML 例で管理している。
- Eleventy などの SSG が既にあり、その中でスタイルガイドを表示したい。
- Hologram/KSS 的な CSS ドキュメントは欲しいが、重いコンポーネントワークショップは不要。
- AI に既存コンポーネントの使い方を読み取らせたい。

### インストール

```sh
npm install -D css-comments-to-json
```

### CLI

```sh
npx css-comments-to-json \
  --input "src/assets/css/**/*.css" \
  --output "src/_data" \
  --prefix styleguide
```

次のような JSON を出力します。

```txt
src/_data/styleguidecomponent.json
src/_data/styleguidebase-component.json
```

### CSS コメント形式

```css
/*
* @sg-category Component
* @sg-name CTA
* @sg-description CTA コンポーネント。
* @sg-table
* | クラス名 | 説明 |
* |----------|------|
* | c-cta | CTA コンテナ |
* @sg-example
<div class="c-cta">
  CTA
</div>
*/
```

対応タグ:

- `@sg-category`
- `@sg-name`
- `@sg-sub-name`
- `@sg-description`
- `@sg-table`
- `@sg-example`
- `@sg-markup`
- `@sg-variant`

書式の補足:

- タグはコメント開始行（`/* @sg-category Component` など）にも書けます。
- `@sg-description` は複数行に続けられます。空行または次のタグで終了します。
- 未知の `@sg-` タグ（タイポを含む）は warning として報告し、無視します。
- 日本語などの非ASCII名は、コンポーネントの `id` と出力ファイル名にそのまま使われます。

### JavaScript API

```js
import { generateStyleguideData } from 'css-comments-to-json';

await generateStyleguideData({
  input: 'src/assets/css/**/*.css',
  output: 'src/_data',
  prefix: 'styleguide',
});
```

CSS 文字列を直接パースする場合:

```js
import { parseStyleguideComments } from 'css-comments-to-json';

const data = parseStyleguideComments(css);
```

### オプション

| Option | Default | Description |
|--------|---------|-------------|
| `input` | `src/assets/css/**/*.css` | CSS 入力 glob |
| `output` | `src/_data` | 出力ディレクトリ |
| `prefix` | `styleguide` | 出力ファイル名の prefix |
| `cwd` | `process.cwd()` | 作業ディレクトリ |
| `dryRun` | `false` | ファイルを書き込まず、出力予定だけ返す |
| `includeSource` | `false` | 出力に元ファイルと行番号を含める |

### 設定ファイル

JavaScript の設定ファイルにオプションをまとめられます。

```js
// css-comments-to-json.config.mjs
export default {
  input: 'src/assets/css/**/*.css',
  output: 'src/_data',
  prefix: 'styleguide',
  includeSource: true,
};
```

次のように実行します。

```sh
npx css-comments-to-json --config css-comments-to-json.config.mjs
```

CLI の指定は、設定ファイルの値を上書きします。

### JSON 出力例

`@sg-category` ごとに 1 つの JSON ファイルを生成します。たとえば
`Component` は、標準の `styleguide` prefix では `styleguidecomponent.json`
になります。

```json
[
  {
    "name": "CTA",
    "id": "cta",
    "description": "CTA component.",
    "children": [],
    "tables": [
      "| Class | Description |\n|-------|-------------|\n| c-cta | CTA container |"
    ],
    "examples": [
      {
        "name": "default",
        "code": "<div class=\"c-cta\">\n  CTA\n</div>"
      }
    ]
  }
]
```

`includeSource` を有効にすると、各コンポーネントに `source.file` と
`source.line` も含まれます。

### Warning

CLI は、不完全なスタイルガイドコメントに warning を出します。

- `@sg-category` がない
- `@sg-name` がない、または空
- `@sg-example`、`@sg-markup`、`@sg-table` の中身が空
- `@sg-name` より前に `@sg-sub-name`、`@sg-example`、`@sg-markup`、
  `@sg-table` が出ている
- 未知の `@sg-` タグ（タイポの可能性）
- input glob にマッチするファイルがない
- 複数のカテゴリが同じ出力ファイル名になる（例: `Base` と `base`）

`--strict` を付けると、warning が1件でもあれば終了コード 1 で終了します。CI での利用に向いています。

```sh
npx css-comments-to-json --input "src/assets/css/**/*.css" --strict
```

JavaScript API でも同じ warning を取得できます。

```js
const result = await generateStyleguideData({
  input: 'src/assets/css/**/*.css',
});

console.log(result.warnings);
```

### 補足

このパッケージは、CSS 互換のブロックコメント（`/* ... */`）から `@sg-` タグを抽出します。そのため、SCSS や PostCSS 用のファイルでも、この形式のコメントが書かれていれば利用できます。

```sh
npx css-comments-to-json \
  --input "src/**/*.{css,scss,pcss}" \
  --output "src/_data" \
  --prefix styleguide
```

SCSS の `// @sg-name` のような行コメントはパース対象外です。

パーサは意図的に軽量にしています。不完全なコメントブロックには warning を出しますが、Markdown テーブルの構文までは検証しません。テーブルの内容は文字列としてそのまま出力します。

プロジェクト固有の独自タグは、現時点では未対応です。現在は README に記載している `@sg-` タグのみをサポートしています。

### Eleventy で使う

Eleventy のビルド前に CLI を実行します。

```json
{
  "scripts": {
    "build:css-comments-json": "css-comments-to-json --input \"src/assets/css/**/*.css\" --output \"src/_data\" --prefix styleguide",
    "build": "npm run build:css-comments-json && eleventy"
  }
}
```
