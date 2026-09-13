import { execSync } from 'node:child_process';

export interface GitContext {
  branch: string;
  repository: string;
}

export function resolveGitContext(workspaceRoot: string): GitContext {
  const execOptions = { cwd: workspaceRoot };

  const remoteOriginUrl = execSync(
    'git config --get remote.origin.url',
    execOptions,
  )
    .toString()
    .trim();

  const branch = execSync('git rev-parse --abbrev-ref HEAD', execOptions)
    .toString()
    .trim();

  const repository = remoteOriginUrl.match(
    globalThis._constants.GITHUB_REPO_PATTERN,
  )?.[2];

  if (!repository) {
    throw new Error('Failed to get repository name from remote origin url');
  }

  return { branch, repository };
}
