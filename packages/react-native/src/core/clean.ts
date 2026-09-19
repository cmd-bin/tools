import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { clearBuilds } from '../utils/clear_builds.js';
import type { CleanOptions, CleanLogEntry } from './types.js';

export async function cleanCore(
  options: CleanOptions,
  onLog?: (entry: CleanLogEntry) => void,
): Promise<{ success: boolean; logs: CleanLogEntry[] }> {
  const logs: CleanLogEntry[] = [];
  const log = (type: CleanLogEntry['type'], message: string) => {
    const entry = { type, message };
    logs.push(entry);
    onLog?.(entry);
  };

  const isDryRun = Boolean(options.dryRun || options['dry-run']);
  let didSpecificClean = false;

  try {
    if (options.vendor) {
      const env = globalThis._constants.ENV;
      let vendorPath =
        env?.BUNDLE_PATH || '~/.cmd-bin/react-native/vendor/bundle';
      if (vendorPath.startsWith('~/') || vendorPath === '~') {
        vendorPath = vendorPath.replace(/^~/, os.homedir());
      }

      const targetPath = path.resolve(vendorPath, '..');
      if (isDryRun) {
        log('warning', `[dry-run] Would delete: ${targetPath}`);
      } else {
        try {
          await fs.rm(targetPath, { recursive: true, force: true });
          log('success', `Vendor bundle cleared: ${vendorPath}`);
        } catch (e: any) {
          log('error', `Failed to delete vendor bundle: ${e.message}`);
        }
      }
      didSpecificClean = true;
    }

    if (options.outputs) {
      const outputsDir =
        globalThis._constants.LANE_OUTPUTS_DIR ||
        path.join(
          os.homedir(),
          '.cmd-bin',
          'react-native',
          'lane-outputs',
        );
      if (isDryRun) {
        log('warning', `[dry-run] Would delete: ${outputsDir}`);
      } else {
        try {
          await fs.rm(outputsDir, { recursive: true, force: true });
          log('success', `Lane outputs cleared: ${outputsDir}`);
        } catch (e: any) {
          log('error', `Failed to delete lane outputs: ${e.message}`);
        }
      }
      didSpecificClean = true;
    }

    const hasDerivedData = Boolean(
      options.derivedData || options['derived-data'],
    );
    if (hasDerivedData) {
      const derivedDataPath = path.join(
        os.homedir(),
        '.cmd-bin',
        'react-native',
        'ios',
        'derived-data',
      );
      if (isDryRun) {
        log('warning', `[dry-run] Would delete: ${derivedDataPath}`);
      } else {
        try {
          await fs.rm(derivedDataPath, { recursive: true, force: true });
          log('success', `Derived data cleared: ${derivedDataPath}`);
        } catch (e: any) {
          log('error', `Failed to delete derived data: ${e.message}`);
        }
      }
      didSpecificClean = true;
    }

    if (!didSpecificClean) {
      const platform = options.platform || 'all';
      if (isDryRun) {
        log(
          'warning',
          `[dry-run] Would clean build directories for platform: ${platform}`,
        );
      } else {
        await clearBuilds(platform as 'android' | 'ios' | 'all', process.cwd(), isDryRun);
        log('success', `Build directories cleared for platform: ${platform}`);
      }
    }

    return { success: true, logs };
  } catch (err: any) {
    log('error', `Clean failed: ${err.message}`);
    return { success: false, logs };
  }
}
