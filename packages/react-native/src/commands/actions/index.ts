import { type CAC } from 'cac';
import { registerFastlaneAction } from '../../utils/fastlane_action.js';
import pkg from '../../../package.json' with { type: 'json' };

/**
 * Registers standalone Fastlane actions as first-class CLI commands.
 */
export const actions = (cli: CAC) => {
  // Google Play Console app status & latest version check
  registerFastlaneAction(cli, {
    actionName: 'check_google_play_console',
    description: 'Check app status and latest version code on Google Play Console',
    options: [
      {
        option: '-t, --track <track>',
        description: 'Google Play track to inspect (e.g. internal, alpha, beta, production)',
      },
      {
        option: '--package_name <package_name>',
        description: 'Application ID / package name to check',
      },
      {
        option: '--credentials_path <credentials_path>',
        description: 'Path to Google Play Store credentials JSON file',
      },
    ],
    examples: [
      `${pkg.name} check_google_play_console`,
      `${pkg.name} check_google_play_console --track internal`,
      `${pkg.name} check_google_play_console --package_name com.example.app --track production`,
    ],
  });

  // App Store Connect access & latest TestFlight build check
  registerFastlaneAction(cli, {
    actionName: 'check_app_store_connect',
    description: 'Check App Store Connect access and latest TestFlight build number',
    options: [
      {
        option: '-a, --app_identifier <app_identifier>',
        description: 'Bundle ID / App Identifier to check in App Store Connect',
      },
    ],
    examples: [
      `${pkg.name} check_app_store_connect`,
      `${pkg.name} check_app_store_connect --app_identifier com.example.app`,
    ],
  });

  // Apple Developer registered device check by UDID or listing all devices
  registerFastlaneAction(cli, {
    actionName: 'check_device_on_store_connect',
    description: 'Check a registered Apple device by UDID or list all registered devices',
    options: [
      {
        option: '-u, --udid <udid>',
        description: 'Specific device UDID to look up (omit to list all devices)',
      },
    ],
    examples: [
      `${pkg.name} check_device_on_store_connect`,
      `${pkg.name} check_device_on_store_connect --udid <device_udid>`,
    ],
  });

  // Register a new Apple device in the Developer Portal
  registerFastlaneAction(cli, {
    actionName: 'add_device_to_store_connect',
    description: 'Register a new Apple device in Apple Developer Portal',
    options: [
      {
        option: '-n, --device_name <device_name>',
        description: 'Device name to register (e.g. John iPhone)',
      },
      {
        option: '-u, --udid <udid>',
        description: 'Device UDID to register',
      },
    ],
    examples: [
      `${pkg.name} add_device_to_store_connect --device_name "John iPhone" --udid <udid>`,
      `${pkg.name} add_device_to_store_connect -n "Test iPad" -u <udid>`,
    ],
  });
};
