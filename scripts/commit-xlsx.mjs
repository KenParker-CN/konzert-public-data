#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { createInterface } from 'readline';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const converterPath = join(__dirname, 'convert-xlsx-to-csv.mjs');

/**
 * Run a git command inside the repository.
 * @param {string[]} args - Arguments to pass to git
 * @param {boolean} allowFailure - Return instead of throwing on a non-zero exit
 * @returns {{status: number|null, stdout: string, stderr: string}} Result
 */
function git(args, allowFailure = false) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf-8' });

  if (result.error) throw result.error;

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${stderr || stdout}`);
  }

  return { status: result.status, stdout, stderr };
}

/**
 * Push the current branch, rebasing over concurrent CSV-only workflow commits.
 * @returns {void}
 */
function pushWithRetry() {
  const firstPush = git(['push'], true);
  if (firstPush.status === 0) return;

  const pushError = `${firstPush.stderr}\n${firstPush.stdout}`.toLowerCase();
  const rejected = pushError.includes('[rejected]')
    || pushError.includes('non-fast-forward')
    || pushError.includes('fetch first');
  if (!rejected) {
    throw new Error(`git push failed: ${firstPush.stderr || firstPush.stdout}`);
  }

  const upstreamResult = git(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    true,
  );
  if (upstreamResult.status !== 0) {
    throw new Error(`git push failed: ${firstPush.stderr || firstPush.stdout}`);
  }

  const fetchResult = git(['fetch'], true);
  if (fetchResult.status !== 0) {
    throw new Error(`git fetch failed: ${fetchResult.stderr || fetchResult.stdout}`);
  }

  const upstream = upstreamResult.stdout;
  const remoteCommits = git(['rev-list', '--count', `HEAD..${upstream}`]);
  if (Number(remoteCommits.stdout) === 0) {
    throw new Error(`git push failed: ${firstPush.stderr || firstPush.stdout}`);
  }

  const mergeBase = git(['merge-base', 'HEAD', upstream]);
  const remoteChanges = git([
    'diff',
    '--name-only',
    `${mergeBase.stdout}..${upstream}`,
  ]).stdout.split('\n').filter(Boolean);
  const onlyGeneratedCsv = remoteChanges.length > 0
    && remoteChanges.every((file) => file.startsWith('csv/') && file.endsWith('.csv'));

  if (!onlyGeneratedCsv) {
    throw new Error(
      `Push rejected because the remote branch has non-CSV changes. `
      + `Sync with ${upstream} and retry. ${firstPush.stderr || firstPush.stdout}`,
    );
  }

  console.log('Remote CSV conversion commit detected; rebasing local changes and retrying push...');
  // Local CSVs were generated from the XLSX changes being rebased.
  git(['rebase', '--autostash', '--strategy-option=theirs', upstream]);
  const retry = git(['push'], true);
  if (retry.status !== 0) {
    throw new Error(`git push failed after rebase: ${retry.stderr || retry.stdout}`);
  }
}

/**
 * Excel creates ~$ lock files next to the workbook while it is open. They are
 * git-ignored, but they can still show up as untracked on some setups.
 * @param {string} filePath - Path to check
 * @returns {boolean} True for temporary lock files
 */
function isLockFile(filePath) {
  return basename(filePath).startsWith('~$');
}

/**
 * Extract the path from a `git status --porcelain` line. Renames use
 * "old -> new", so the right-hand side wins.
 * @param {string} line - One porcelain line
 * @returns {string} Repo-relative path
 */
function pathFromPorcelain(line) {
  const raw = line.slice(3).trim();
  const arrow = raw.indexOf(' -> ');
  return arrow === -1 ? raw : raw.slice(arrow + 4).trim();
}

/**
 * List the XLSX files that are added, modified, renamed or deleted.
 * @returns {string[]} Repo-relative paths
 */
function changedXlsxFiles() {
  return git(['status', '--porcelain', '--', 'xlsx'])
    .stdout.split('\n')
    .filter(Boolean)
    .map(pathFromPorcelain)
    .filter((file) => file.toLowerCase().endsWith('.xlsx') && !isLockFile(file));
}

/**
 * Regenerate the CSV for the given XLSX files by delegating to the converter.
 * @param {string[]} xlsxFiles - Repo-relative XLSX paths
 */
function convert(xlsxFiles) {
  if (xlsxFiles.length === 0) return;

  const names = xlsxFiles.map((file) => basename(file));
  const result = spawnSync(process.execPath, [converterPath, ...names], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('XLSX to CSV conversion failed');
}

/**
 * Render a file list for a commit subject.
 * @param {string[]} files - File names
 * @returns {string} Comma-separated list, collapsed when long
 */
function formatList(files) {
  if (files.length <= 3) return files.join(', ');
  return `${files.length} files`;
}

/**
 * Build a conventional-commit style subject for the staged changes.
 * @param {string[]} staged - Repo-relative staged paths
 * @returns {string} Commit subject
 */
function buildMessage(staged) {
  const sources = staged
    .filter((file) => file.toLowerCase().endsWith('.xlsx') && !isLockFile(file))
    .map((file) => basename(file, '.xlsx'));

  if (sources.length > 0) {
    const label = sources.length <= 3 ? formatList(sources) : `${sources.length} sources`;
    return `data: update ${label}`;
  }

  return `chore: update ${formatList(staged.map((file) => basename(file)))}`;
}

/**
 * Ask for a commit message, offering the generated one as the default.
 * @param {string} suggestion - Message used when the user just hits enter
 * @returns {Promise<string>} The chosen message
 */
function askForMessage(suggestion) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nCommit message (Enter keeps it, q aborts):');
    rl.question(`  > ${suggestion}\n  `, (answer) => {
      rl.close();
      resolve(answer.trim() || suggestion);
    });
  });
}

/**
 * Convert the changed workbooks, stage them together with their CSVs and commit.
 * @param {{message?: string, push: boolean, ask: boolean}} options - User supplied options
 * @returns {Promise<void>} Resolves once the commit is done
 */
async function main({ message, push, ask }) {
  const changed = changedXlsxFiles();

  if (changed.length === 0) {
    console.log('No XLSX changes found in xlsx/.');
  } else {
    console.log(`Changed XLSX: ${changed.map((file) => basename(file)).join(', ')}`);
    convert(changed);
  }

  git(['add', '-A', '--', 'xlsx', 'csv']);

  const staged = git(['diff', '--cached', '--name-only'])
    .stdout.split('\n')
    .filter(Boolean);

  if (staged.length === 0) {
    console.log('Nothing to commit.');

    if (push) {
      const pending = git(['log', '--oneline', '@{upstream}..HEAD'], true);

      if (pending.status === 0 && pending.stdout) {
        console.log(`\nUnpushed commits:\n${pending.stdout}\n`);
        pushWithRetry();
        console.log('✓ Pushed.');
      } else {
        console.log('Nothing to push.');
      }
    }

    return;
  }

  console.log(`\nStaged:\n${staged.map((file) => `  ${file}`).join('\n')}`);

  const suggestion = buildMessage(staged);
  let subject = message || suggestion;

  if (!message && (ask || process.stdin.isTTY)) {
    subject = await askForMessage(suggestion);
    if (subject.toLowerCase() === 'q') {
      console.log('Aborted, nothing committed.');
      return;
    }
  }

  git(['commit', '-m', subject]);
  console.log(`\n✓ Committed: ${subject}`);

  const leftovers = git(['status', '--porcelain'], true)
    .stdout.split('\n')
    .filter(Boolean);

  if (leftovers.length > 0) {
    console.log('\nNot committed (outside xlsx/ and csv/):');
    console.log(leftovers.map((line) => `  ${line}`).join('\n'));
  }

  if (push) {
    pushWithRetry();
    console.log('✓ Pushed.');
  } else {
    console.log('\nNot pushed. Run: git push');
  }
}

const args = process.argv.slice(2);
const push = !args.includes('--no-push');
const ask = args.includes('--ask');
const messageIndex = args.indexOf('--message');
const message = messageIndex === -1 ? undefined : args[messageIndex + 1];

main({ message, push, ask }).catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
