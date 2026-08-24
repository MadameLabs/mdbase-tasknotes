import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Absoluto: os testes rodam com cwd na colecao temporaria, onde dist/ nao existe.
const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

const ANSI_RE = /\u001b\[[0-9;]*m/g;

export function makeTempDir(prefix = 'mtn-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function stripAnsi(text) {
  return text.replace(ANSI_RE, '');
}

export function runCli(args, opts = {}) {
  // Antes isto passava por `bash -lc` com redirecionamento: no Windows os
  // caminhos com barra invertida viravam nomes literais e o teste criava
  // diretorios de lixo dentro do repositorio. spawnSync direto e portavel.
  const result = spawnSync(process.execPath, [CLI, ...args.map(String)], {
    cwd: opts.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
