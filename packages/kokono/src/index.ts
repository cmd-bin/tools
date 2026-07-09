#!/usr/bin/env node

import process from 'node:process';
import { cac, type CAC } from 'cac';
import { encrypt, type EncryptedData } from './utils/crypto.js';
import pkg from '../package.json' with { type: 'json' };

const URL = process.env.KOKONO_API_URL || 'https://kokono.me/notify';

const cli: CAC = cac(pkg.name);

cli.version(pkg.version);

interface NotificationPayload {
  token: string;
  title?: string | EncryptedData;
  message?: string | EncryptedData;
  encrypted?: 1;
}

cli
  .command('', 'Send a notification via Kokono')
  .option('--token <token>', 'Authentication token (required)')
  .option('--title <title>', 'Notification title')
  .option('--message <message>', 'Notification message')
  .option('--e2e <publicKey>', 'End-to-End Encryption public key')
  .action(async (options) => {
    try {
      if (!options.token) {
        console.error('Error: --token is required.');
        process.exit(1);
      }

      if (options.e2e && (!options.title || !options.message)) {
        console.error(
          'Error: --title and --message are required when --e2e is provided.',
        );
        process.exit(1);
      }

      let payload: NotificationPayload = { token: options.token };

      if (options.e2e) {
        payload.encrypted = 1;
        if (options.title) {
          payload.title = encrypt(options.e2e, options.title);
        }
        if (options.message) {
          payload.message = encrypt(options.e2e, options.message);
        }
      } else {
        if (options.title) {
          payload.title = options.title;
        }
        if (options.message) {
          payload.message = options.message;
        }
      }

      const response = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `API responded with status ${response.status}: ${text}`,
        );
      }

      const data = await response.json().catch(() => null);
      if (data.success) {
        console.log('Notification sent successfully!');
      } else {
        console.error(
          'Failed to send notification:',
          data ? JSON.stringify(data) : 'Unknown error',
        );
      }
    } catch (error: unknown) {
      console.error('Failed to send notification:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

cli.help();

try {
  cli.parse();
} catch (e: any) {
  console.error(e.message);
  process.exit(1);
}
