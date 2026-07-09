import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import dotenv from 'dotenv';

function setSecretViaStdin(key: string, value: string, cwd: string) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['secret', 'set', key], {
      cwd,
      stdio: ['pipe', 'ignore', 'inherit'],
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(0);
      } else {
        reject(new Error(`gh secret set exited with code ${code}`));
      }
    });

    child.stdin.write(value);
    child.stdin.end();
  });
}

export async function setSecrets() {
  const callerWorkspace = process.cwd();

  // 1. Check if gh is installed
  let hasGh = false;
  try {
    execSync('which gh', { stdio: 'ignore' });
    hasGh = true;
  } catch {
    hasGh = false;
  }

  // 2. If gh is not installed, try to install it
  if (!hasGh) {
    console.log(pc.yellow('⚠️  GitHub CLI (gh) is not installed.'));

    // Check if brew is installed
    let hasBrew = false;
    try {
      execSync('which brew', { stdio: 'ignore' });
      hasBrew = true;
    } catch {
      hasBrew = false;
    }

    if (hasBrew) {
      console.log(
        pc.cyan('🍺  Homebrew detected. Installing GitHub CLI (gh)...'),
      );
      try {
        execSync('brew install gh', { stdio: 'inherit' });
        console.log(pc.green('✅  GitHub CLI (gh) installed successfully!'));
      } catch (err: unknown) {
        throw new Error(
          `Failed to install gh via Homebrew: ${(err as Error).message}`,
        );
      }
    } else {
      console.log(pc.red('❌  Homebrew (brew) is not installed.'));
      console.log(pc.bold('\nPlease install GitHub CLI manually:'));
      console.log('👉  Using Homebrew: brew install gh');
      console.log('👉  Other systems: https://cli.github.com/');
      process.exit(1);
    }
  }

  // 3. Check if user is authenticated with gh
  try {
    execSync('gh auth status', { stdio: 'ignore' });
  } catch {
    console.log(pc.red('❌  You are not authenticated with GitHub CLI.'));
    console.log(pc.bold('\nPlease run the following command to log in:'));
    console.log(pc.cyan('👉  gh auth login'));
    process.exit(1);
  }

  // 4. Check if .env.deploy exists
  const envPath = path.join(callerWorkspace, '.env.deploy');
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `.env.deploy not found in current directory: ${callerWorkspace}`,
    );
  }

  // 5. Read the environment keys from .env.deploy and filter reserved ones
  const envContent = fs.readFileSync(envPath);
  const parsedEnv = dotenv.parse(envContent);

  const validSecrets: Record<string, string> = {};
  const ignoredKeys = [];

  for (const [key, value] of Object.entries(parsedEnv)) {
    if (key.toUpperCase().startsWith('GITHUB_')) {
      ignoredKeys.push(key);
    } else {
      validSecrets[key] = value;
    }
  }

  const keys = Object.keys(validSecrets);

  if (ignoredKeys.length > 0) {
    console.log(
      pc.yellow(
        `⚠️  Ignored keys starting with "GITHUB_" (reserved by GitHub): ${ignoredKeys.join(', ')}`,
      ),
    );
  }

  if (keys.length === 0) {
    console.log(
      pc.yellow('⚠️  No valid environment variables found in .env.deploy.'),
    );
    return;
  }

  console.log(
    pc.cyan(`📤  Uploading ${keys.length} secrets to GitHub repository...`),
  );

  // 6. Set secrets one by one using stdin to support multi-line values safely
  try {
    for (const key of keys) {
      console.log(pc.dim(`🔑  Setting secret: ${pc.bold(key)}...`));
      await setSecretViaStdin(key, validSecrets[key], callerWorkspace);
    }

    const timeString = new Date().toTimeString().split(' ')[0];
    console.log(
      pc.dim(pc.gray(`(${timeString})`)) +
        ' ' +
        pc.green(`✅  Successfully set the following secrets:`),
    );
    keys.forEach((key) => {
      console.log(`   - ${pc.bold(key)}`);
    });
  } catch (err: unknown) {
    throw new Error(
      `Failed to set secrets via gh CLI: ${(err as Error).message}`,
    );
  }
}
