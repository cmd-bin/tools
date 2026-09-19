import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import path from 'node:path';
import { ensureRubyEnvironment } from '../utils/ruby.js';
import { runTask } from './task.js';
import type { TaskEvent, TaskResult } from './types.js';

export async function initCore(
  cwd: string = process.cwd(),
  onEvent?: (event: TaskEvent) => void,
): Promise<{ success: boolean; results: TaskResult[] }> {
  const results: TaskResult[] = [];

  const execute = async (
    id: string,
    title: string,
    fn: (log: (msg: string) => void) => Promise<string | void>,
  ) => {
    const res = await runTask({ id, title, onEvent }, fn);
    results.push(res);
    return res;
  };

  // 1. .env.deploy
  await execute('env', 'Checking .env.deploy', async (log) => {
    const envDeployPath = path.join(cwd, '.env.deploy');
    try {
      await fs.access(envDeployPath);
      log('.env.deploy already exists.');
    } catch {
      await fs.writeFile(envDeployPath, '', 'utf-8');
      log('Created .env.deploy');
    }
  });

  // 2. .tool-versions
  await execute('tools', 'Checking .tool-versions', async (log) => {
    const toolVersionsPath = path.join(cwd, '.tool-versions');
    try {
      await fs.access(toolVersionsPath);
      log('.tool-versions already exists.');
    } catch {
      const currentNodeVersion = process.version.replace(/^v/, '');
      const majorVersion = parseInt(currentNodeVersion.split('.')[0], 10);
      const nodeVersionToUse = majorVersion >= 24 ? currentNodeVersion : '26';
      const content = `nodejs ${nodeVersionToUse}\nruby 4.0.6\n`;
      await fs.writeFile(toolVersionsPath, content, 'utf-8');
      log(`Created .tool-versions (node: ${nodeVersionToUse}, ruby: 4.0.6)`);
    }
  });

  // 3. .gitignore
  await execute('gitignore', 'Checking .gitignore', async (log) => {
    const gitignorePath = path.join(cwd, '.gitignore');
    let content = '';
    try {
      content = await fs.readFile(gitignorePath, 'utf-8');
    } catch {}

    const lines = content.split('\n');
    let updated = false;

    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (!lines.includes('.env.deploy')) {
      lines.push('.env.deploy');
      updated = true;
    }

    if (updated) {
      const newContent = lines.join('\n') + '\n';
      await fs.writeFile(gitignorePath, newContent, 'utf-8');
      log('Updated .gitignore');
      return;
    }

    log('.gitignore is already up to date.');
  });

  // 4. Ruby environment
  await execute('ruby', 'Preparing Ruby Environment', async (log) => {
    log('Ensuring Ruby & Bundler dependencies...');
    const {rubyBinDir } = await ensureRubyEnvironment(process.env, true);
    return log(`Ruby is ready at ${rubyBinDir}.`);
  });

  const hasError = results.some((r) => r.status === 'error');
  return { success: !hasError, results };
}
