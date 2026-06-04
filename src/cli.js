#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateStyleguideData } from './index.js';

function printHelp() {
  console.log(`Usage:
  css-comments-to-json [options]

Options:
  --input <glob>     CSS input glob (default: src/assets/css/**/*.css)
  --output <dir>     Output directory (default: src/_data)
  --prefix <name>    Output filename prefix (default: styleguide)
  --cwd <dir>        Working directory (default: process.cwd())
  --config <file>    Load options from a JS config file
  --source           Include source file and line in output
  --dry-run          Print files that would be written without writing
  --help             Show this help

Example:
  css-comments-to-json --input "src/assets/css/**/*.css" --output "src/_data"`);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--source') {
      options.includeSource = true;
    } else if (
      arg === '--input' ||
      arg === '--output' ||
      arg === '--prefix' ||
      arg === '--cwd' ||
      arg === '--config'
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function loadConfig(configPath, cwd) {
  if (!configPath) {
    return {};
  }

  const absolutePath = path.resolve(cwd || process.cwd(), configPath);
  const configModule = await import(pathToFileURL(absolutePath).href);
  const config = configModule.default || configModule;

  if (!config || typeof config !== 'object') {
    throw new Error(`Config must export an object: ${configPath}`);
  }

  return config;
}

async function main() {
  const cliOptions = parseArgs(process.argv.slice(2));

  if (cliOptions.help) {
    printHelp();
    return;
  }

  const config = await loadConfig(cliOptions.config, cliOptions.cwd);
  const optionsFromCli = { ...cliOptions };
  delete optionsFromCli.config;
  delete optionsFromCli.help;
  const options = {
    ...config,
    ...optionsFromCli,
  };
  const result = await generateStyleguideData(options);

  for (const warning of result.warnings) {
    const source = warning.source
      ? `${warning.source.file}${warning.source.line ? `:${warning.source.line}` : ''}`
      : 'unknown source';
    console.warn(`[warn] ${source} ${warning.message}`);
  }

  if (options.dryRun) {
    for (const outputFile of result.outputFiles) {
      console.log(`[dry-run] ${outputFile.filePath}`);
    }
  } else {
    for (const outputFile of result.outputFiles) {
      console.log(`write ${outputFile.filePath}`);
    }
  }

  console.log(
    `parsed ${result.files.length} files, generated ${result.outputFiles.length} files`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
