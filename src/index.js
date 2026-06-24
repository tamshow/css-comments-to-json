import fs from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'glob';

export const defaultOptions = {
  input: 'src/assets/css/**/*.css',
  output: 'src/_data',
  prefix: 'styleguide',
  cwd: process.cwd(),
  dryRun: false,
  includeSource: false,
  warnings: undefined,
};

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function removeStyleAttributes(html) {
  return html.replace(/ style="[^"]*"/g, '');
}

function formatSource(source) {
  if (!source) return 'unknown source';
  return `${source.file}${source.line ? `:${source.line}` : ''}`;
}

function pushWarning(warnings, message, source) {
  if (!warnings) return;
  warnings.push({
    message,
    source,
  });
}

function getBlockName(value) {
  return value.trim().split(/\s+/)[0] || 'default';
}

function pushExample(target, currentExample, warnings, source) {
  if (!target || currentExample.length === 0) return;
  const code = removeStyleAttributes(currentExample.slice(1).join('\n').trim());

  if (!code) {
    pushWarning(warnings, '@sg-example has no example body', source);
  }

  target.examples = target.examples || [];
  target.examples.push({
    name: getBlockName(currentExample[0]),
    code,
  });
}

function pushMarkup(target, currentMarkup, warnings, source) {
  if (!target || currentMarkup.length === 0) return;
  const code = removeStyleAttributes(currentMarkup.slice(1).join('\n').trim());

  if (!code) {
    pushWarning(warnings, '@sg-markup has no markup body', source);
  }

  target.markup = target.markup || [];
  target.markup.push({
    name: getBlockName(currentMarkup[0]),
    code,
  });
}

function pushTable(target, currentTable, warnings, source) {
  if (!target || currentTable.length === 0) return;
  const table = currentTable.join('\n').trim();

  if (!table) {
    pushWarning(warnings, '@sg-table has no table body', source);
  }

  target.tables = target.tables || [];
  target.tables.push(table);
}

function getCommentStartLine(content, commentStartIndex) {
  return content.slice(0, commentStartIndex).split('\n').length;
}

function normalizeCommentLines(comment) {
  return comment
    .replace(/^\/\*+/, '')
    .replace(/\*+\/$/, '')
    .split('\n')
    .map((line) => line.trim().replace(/^\*\s?/, ''))
    .filter((line) => line !== '*/' && line !== '/');
}

const KNOWN_TAGS = new Set([
  '@sg-category',
  '@sg-name',
  '@sg-sub-name',
  '@sg-description',
  '@sg-example',
  '@sg-markup',
  '@sg-variant',
  '@sg-table',
]);

function getOrCreateComponent(categoryMap, category, name, source) {
  const parentId = slugify(name);
  if (!categoryMap[category]) categoryMap[category] = [];

  let component = categoryMap[category].find((item) => item.name === name);

  if (!component) {
    component = {
      name,
      id: parentId,
      children: [],
    };

    if (source) {
      component.source = source;
    }

    categoryMap[category].push(component);
  }

  return component;
}

export function parseStyleguideComment(comment, categoryMap, options = {}) {
  const { source, warningSource = source, warnings } = options;
  const lines = normalizeCommentLines(comment);

  let parentComponent = null;
  let childComponent = null;
  let currentExample = [];
  let currentMarkup = [];
  let currentTable = [];
  let inTableBlock = false;
  let descriptionTarget = null;
  let category = 'default';
  let hasCategory = false;
  let hasName = false;

  function flushBlocks() {
    const target = childComponent || parentComponent;
    pushExample(target, currentExample, warnings, warningSource);
    pushMarkup(target, currentMarkup, warnings, warningSource);
    pushTable(target, currentTable, warnings, warningSource);
    currentExample = [];
    currentMarkup = [];
    currentTable = [];
    inTableBlock = false;
  }

  for (const line of lines) {
    const tagMatch = line.match(/^(@sg-[a-z][a-z-]*)\s*(.*)$/);
    const tag = tagMatch && KNOWN_TAGS.has(tagMatch[1]) ? tagMatch[1] : null;
    const value = tag ? tagMatch[2].trim() : '';

    if (tag) {
      flushBlocks();
      descriptionTarget = null;
    }

    if (tag === '@sg-category') {
      category = value || 'default';
      hasCategory = true;
    } else if (tag === '@sg-name') {
      if (!value) {
        pushWarning(warnings, '@sg-name is empty', warningSource);
        continue;
      }

      hasName = true;
      parentComponent = getOrCreateComponent(
        categoryMap,
        category,
        value,
        source,
      );
      childComponent = null;
    } else if (tag === '@sg-sub-name') {
      if (!parentComponent) {
        pushWarning(
          warnings,
          '@sg-sub-name appears before @sg-name',
          warningSource,
        );
      }
      childComponent = {
        subName: value,
      };
      if (source) {
        childComponent.source = source;
      }
      if (parentComponent) {
        parentComponent.children.push(childComponent);
      }
    } else if (tag === '@sg-description') {
      const target = childComponent || parentComponent;
      if (target) {
        target.description = value;
        descriptionTarget = target;
      }
    } else if (tag === '@sg-example') {
      if (!childComponent && !parentComponent) {
        pushWarning(
          warnings,
          '@sg-example appears before @sg-name',
          warningSource,
        );
      }
      currentExample.push(value);
    } else if (tag === '@sg-markup') {
      if (!childComponent && !parentComponent) {
        pushWarning(
          warnings,
          '@sg-markup appears before @sg-name',
          warningSource,
        );
      }
      currentMarkup.push(value);
    } else if (tag === '@sg-variant') {
      const target = childComponent || parentComponent;
      if (target) {
        target.variants = target.variants || [];
        target.variants.push(value);
      }
    } else if (tag === '@sg-table') {
      if (!childComponent && !parentComponent) {
        pushWarning(
          warnings,
          '@sg-table appears before @sg-name',
          warningSource,
        );
      }
      inTableBlock = true;
    } else if (line.startsWith('@sg-')) {
      flushBlocks();
      descriptionTarget = null;
      pushWarning(
        warnings,
        `unknown tag "${line.split(/\s+/)[0]}" was ignored`,
        warningSource,
      );
    } else if (inTableBlock) {
      currentTable.push(line);
    } else if (currentExample.length > 0) {
      currentExample.push(line);
    } else if (currentMarkup.length > 0) {
      currentMarkup.push(line);
    } else if (descriptionTarget) {
      if (line === '') {
        descriptionTarget = null;
      } else {
        descriptionTarget.description = descriptionTarget.description
          ? `${descriptionTarget.description}\n${line}`
          : line;
      }
    }
  }

  if (!hasCategory) {
    pushWarning(
      warnings,
      `@sg-category is missing; using "default" for ${formatSource(warningSource)}`,
      warningSource,
    );
  }
  if (!hasName) {
    pushWarning(
      warnings,
      '@sg-name is missing; comment block was ignored',
      warningSource,
    );
  }

  flushBlocks();
}

export function parseStyleguideComments(content, options = {}) {
  const mergedOptions = {
    filePath: undefined,
    includeSource: false,
    warnings: undefined,
    ...options,
  };
  const categoryMap = {};
  const commentRegex = /\/\*[\s\S]*?\*\//g;
  const matches = content.matchAll(commentRegex);

  for (const match of matches) {
    const comment = match[0];
    if (!/@sg-/.test(comment)) continue;

    const sourceBase = mergedOptions.filePath
      ? {
          file: mergedOptions.filePath,
          line: getCommentStartLine(content, match.index || 0),
        }
      : undefined;
    const source =
      mergedOptions.includeSource && sourceBase
        ? sourceBase
        : undefined;
    const warningSource =
      sourceBase
        ? {
            ...sourceBase,
          }
        : undefined;

    parseStyleguideComment(comment, categoryMap, {
      source,
      warningSource,
      warnings: mergedOptions.warnings,
    });
  }

  return categoryMap;
}

export function mergeCategoryMaps(target, source) {
  for (const [category, components] of Object.entries(source)) {
    if (!target[category]) target[category] = [];

    for (const component of components) {
      const existing = target[category].find(
        (item) => item.name === component.name,
      );

      if (existing) {
        existing.children.push(...(component.children || []));
        if (component.description && !existing.description) {
          existing.description = component.description;
        }
        if (component.tables) {
          existing.tables = [...(existing.tables || []), ...component.tables];
        }
        if (component.examples) {
          existing.examples = [
            ...(existing.examples || []),
            ...component.examples,
          ];
        }
        if (component.markup) {
          existing.markup = [...(existing.markup || []), ...component.markup];
        }
        if (component.variants) {
          existing.variants = [
            ...(existing.variants || []),
            ...component.variants,
          ];
        }
      } else {
        target[category].push(component);
      }
    }
  }

  return target;
}

export async function collectStyleguideData(options = {}) {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };
  const files = globSync(mergedOptions.input, {
    cwd: mergedOptions.cwd,
    nodir: true,
  }).sort();
  const categoryMap = {};
  const warnings = mergedOptions.warnings || [];

  if (files.length === 0) {
    pushWarning(
      warnings,
      `no files matched input "${mergedOptions.input}"`,
      undefined,
    );
  }

  for (const file of files) {
    const absolutePath = path.resolve(mergedOptions.cwd, file);
    const content = await fs.readFile(absolutePath, 'utf8');
    const parsed = parseStyleguideComments(content, {
      filePath: file,
      includeSource: mergedOptions.includeSource,
      warnings,
    });
    mergeCategoryMaps(categoryMap, parsed);
  }

  return {
    files,
    categories: categoryMap,
    warnings,
  };
}

export function createOutputFiles(categories, options = {}) {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  const seenPaths = new Map();

  return Object.entries(categories).map(([category, components]) => {
    const safeCategory = slugify(category) || 'default';
    const fileName = `${mergedOptions.prefix}${safeCategory}.json`;
    const filePath = path.resolve(
      mergedOptions.cwd,
      mergedOptions.output,
      fileName,
    );

    if (seenPaths.has(filePath)) {
      pushWarning(
        mergedOptions.warnings,
        `output file collision: categories "${seenPaths.get(filePath)}" and "${category}" both write ${fileName}`,
        undefined,
      );
    } else {
      seenPaths.set(filePath, category);
    }

    return {
      category,
      filePath,
      data: components,
      json: `${JSON.stringify(components, null, 2)}\n`,
    };
  });
}

export async function writeStyleguideData(categories, options = {}) {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };
  const outputFiles = createOutputFiles(categories, mergedOptions);

  if (mergedOptions.dryRun) {
    return outputFiles;
  }

  for (const outputFile of outputFiles) {
    await fs.mkdir(path.dirname(outputFile.filePath), { recursive: true });
    await fs.writeFile(outputFile.filePath, outputFile.json, 'utf8');
  }

  return outputFiles;
}

export async function generateStyleguideData(options = {}) {
  const collected = await collectStyleguideData(options);
  const outputFiles = await writeStyleguideData(collected.categories, {
    ...options,
    warnings: collected.warnings,
  });

  return {
    ...collected,
    outputFiles,
  };
}
