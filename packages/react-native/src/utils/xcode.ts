import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  PBXAggregateTarget,
  PBXBuildFile,
  PBXCopyFilesBuildPhase,
  PBXLegacyTarget,
  PBXNativeTarget,
  PBXProject,
  PBXTargetDependency,
  XCBuildConfiguration,
  XcodeProject,
  XCScheme,
} from '@bacons/xcode';
import type { PBXProductType } from '@bacons/xcode/json';

const VARIABLE_PATTERN = /\$\(([^)]+)\)|\$\{([^}]+)\}/g;
const APPLICATION_PRODUCT_TYPE = 'com.apple.product-type.application';
const DISTRIBUTABLE_PRODUCT_TYPE_KEYWORDS = [
  'application',
  'app-extension',
  'extension',
  'messages-extension',
  'widgetkit-extension',
  'watchkit2-extension',
];
const EXCLUDED_PRODUCT_TYPES: string[] = [
  'com.apple.product-type.bundle',
  'com.apple.product-type.bundle.unit-test',
  'com.apple.product-type.bundle.ui-testing',
  'com.apple.product-type.framework',
  'com.apple.product-type.framework.static',
  'com.apple.product-type.library.dynamic',
  'com.apple.product-type.library.static',
  'com.apple.product-type.tool',
  'com.apple.product-type.xpc-service',
];

export type NormalizedValue = string | string[] | null;

export type XcodeTarget =
  PBXNativeTarget | PBXAggregateTarget | PBXLegacyTarget;

export type BuildConfigurationOwner = PBXProject | XcodeTarget;

export type XcodebuildTargetBuildSettings = Record<
  string,
  Record<string, NormalizedValue>
>;

export type ConfigurationSource =
  'build_settings' | 'xcodebuild' | 'xcconfig' | 'env_fallback';

export interface ResolveIosBundleIdentifiersOptions {
  workspaceName?: string;
  scheme?: string;
  workspaceRoot?: string;
  configuration?: string;
  production?: boolean;
  [key: string]: unknown;
}

export interface ResolvedTargetInfo {
  name: string;
  bundle_id: string;
  productType: PBXProductType | string;
  configurationSource: ConfigurationSource | null;
}

export interface ResolveIosBundleIdentifiersResult {
  workspaceName: string;
  scheme: string;
  configuration: string;
  mainAppTargetName: string | null;
  bundle_id: string | null;
  appIdentifier: string | null;
  buildableNames: string[];
  targets: ResolvedTargetInfo[];
  iosRoot: string;
}

export function literalValue(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeValue(value: unknown): NormalizedValue {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeValue(item))
      .filter((item): item is string => Boolean(item));
  }

  return literalValue(value);
}

export function unresolvedReference(value: unknown): boolean {
  const normalized = literalValue(value);
  return normalized
    ? normalized.includes('$(') || normalized.includes('${')
    : false;
}

export function getResolvedSettingFromMap(
  key: string,
  settings: Record<string, unknown>,
  seen: Set<string> = new Set(),
): NormalizedValue {
  const value = settings[key];
  if (typeof value !== 'string') {
    return normalizeValue(value);
  }

  if (seen.has(key)) {
    return literalValue(value);
  }

  const nextSeen = new Set(seen);
  nextSeen.add(key);

  const resolved = value.replace(
    VARIABLE_PATTERN,
    (match: string, parenName?: string, braceName?: string): string => {
      const variableName = parenName || braceName;
      if (!variableName) return match;

      const [settingName] = variableName.split(':');
      if (!settingName) return match;

      if (settingName === 'TARGET_NAME') {
        return literalValue(settings.TARGET_NAME) || match;
      }

      if (settingName in settings) {
        const resolvedValue = getResolvedSettingFromMap(
          settingName,
          settings,
          nextSeen,
        );
        return (resolvedValue != null ? String(resolvedValue) : null) ?? match;
      }

      return process.env[settingName] ?? match;
    },
  );

  return literalValue(resolved);
}

export function distributableTarget(
  target: XcodeTarget,
): target is PBXNativeTarget {
  const productType =
    'productType' in target.props
      ? literalValue((target.props as { productType?: unknown }).productType)
      : null;
  if (!productType) return false;
  if (EXCLUDED_PRODUCT_TYPES.includes(productType)) return false;

  return DISTRIBUTABLE_PRODUCT_TYPE_KEYWORDS.some((keyword) =>
    productType.includes(keyword),
  );
}

function applicationTarget(target: XcodeTarget): boolean {
  const productType =
    'productType' in target.props
      ? literalValue((target.props as { productType?: unknown }).productType)
      : null;
  return productType === APPLICATION_PRODUCT_TYPE;
}

function uniqueTargets<T extends XcodeTarget>(targets: T[]): T[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (!target) return false;
    const key = target.uuid || target.props.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dependencyTargets(
  target: PBXNativeTarget,
  allTargets: PBXNativeTarget[],
): PBXNativeTarget[] {
  return target.props.dependencies
    .map((dependency: PBXTargetDependency) => dependency.getNativeTargetUuid())
    .map((uuid: string) =>
      allTargets.find((candidate) => candidate.uuid === uuid),
    )
    .filter((candidate): candidate is PBXNativeTarget => Boolean(candidate));
}

function targetProductName(target: PBXNativeTarget): string | null {
  return (
    literalValue(target.props.productReference?.getDisplayName?.()) ||
    literalValue(target.getDisplayName?.())
  );
}

function embeddedExtensionTargets(
  target: PBXNativeTarget,
  allTargets: PBXNativeTarget[],
): PBXNativeTarget[] {
  const embeddedProductNames = target.props.buildPhases.flatMap((phase) => {
    if (
      !PBXCopyFilesBuildPhase.is(phase) ||
      String(phase.props.dstSubfolderSpec) !== '13'
    ) {
      return [];
    }

    return phase.props.files
      .map((file: PBXBuildFile) =>
        literalValue(file.props.fileRef?.getDisplayName?.()),
      )
      .filter((name): name is string => Boolean(name?.endsWith('.appex')));
  });

  if (embeddedProductNames.length === 0) return [];

  return allTargets.filter((candidate) => {
    const name = targetProductName(candidate);
    return name !== null && embeddedProductNames.includes(name);
  });
}

export function expandBuildableTargets(
  buildableTargets: PBXNativeTarget[],
  allTargets: PBXNativeTarget[],
): PBXNativeTarget[] {
  return uniqueTargets([
    ...buildableTargets,
    ...buildableTargets.flatMap((target) => [
      ...dependencyTargets(target, allTargets),
      ...embeddedExtensionTargets(target, allTargets),
    ]),
  ]);
}

export function getBuildConfiguration(
  owner: BuildConfigurationOwner | null | undefined,
  configurationName?: string | null,
): XCBuildConfiguration | null {
  if (!owner) return null;

  const defaultConfiguration =
    'getDefaultConfiguration' in owner &&
    typeof (owner as { getDefaultConfiguration?: () => XCBuildConfiguration })
      .getDefaultConfiguration === 'function'
      ? (
          owner as { getDefaultConfiguration: () => XCBuildConfiguration }
        ).getDefaultConfiguration() || null
      : null;

  if (!configurationName) {
    return defaultConfiguration;
  }

  if (defaultConfiguration?.props.name === configurationName) {
    return defaultConfiguration;
  }

  return (
    owner.props.buildConfigurationList?.props?.buildConfigurations?.find(
      (configuration: XCBuildConfiguration) =>
        configuration.props.name === configurationName,
    ) || null
  );
}

export function rawBundleIdentifier(
  target: PBXNativeTarget,
  configurationName?: string | null,
): NormalizedValue {
  const configuration = getBuildConfiguration(target, configurationName);

  if (!configuration && !configurationName) {
    return normalizeValue(
      target.getDefaultBuildSetting?.('PRODUCT_BUNDLE_IDENTIFIER'),
    );
  }

  return normalizeValue(
    configuration?.props?.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER,
  );
}

export function resolveXcconfigBundleIdentifier(
  project: XcodeProject,
  target: PBXNativeTarget,
  configurationName?: string | null,
  rawBundleId?: NormalizedValue,
): NormalizedValue {
  const projectConfiguration = getBuildConfiguration(
    project.rootObject,
    configurationName,
  );
  const targetConfiguration = getBuildConfiguration(target, configurationName);

  const settings: Record<string, unknown> = {
    ...projectConfiguration?.getBaseConfigurationSettings?.(),
    ...projectConfiguration?.props?.buildSettings,
    ...targetConfiguration?.getBaseConfigurationSettings?.(),
    ...targetConfiguration?.props?.buildSettings,
    TARGET_NAME: target.props.name,
  };

  if (rawBundleId) {
    settings.PRODUCT_BUNDLE_IDENTIFIER = rawBundleId;
  }

  return getResolvedSettingFromMap('PRODUCT_BUNDLE_IDENTIFIER', settings);
}

export function parseXcodebuildBuildSettings(
  output: string | null | undefined,
): XcodebuildTargetBuildSettings {
  if (!output?.trim()) return {};

  const settingsByTarget: XcodebuildTargetBuildSettings = {};
  let currentTarget: string | null = null;

  for (const line of output.split(/\r?\n/)) {
    const headerMatch = line.match(
      /Build settings for action .+? and target (.+?)(?: from project .+)?\s*:/,
    );
    if (headerMatch) {
      currentTarget = headerMatch[1].trim();
      settingsByTarget[currentTarget] ||= {};
      continue;
    }

    if (line.startsWith('Build settings from command line:')) {
      currentTarget = null;
      continue;
    }

    if (!currentTarget) continue;

    const settingMatch = line.match(/^\s{2,}([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!settingMatch) continue;

    settingsByTarget[currentTarget][settingMatch[1]] = normalizeValue(
      settingMatch[2],
    );
  }

  return settingsByTarget;
}

export function captureXcodebuildBuildSettings(
  workspacePath: string,
  scheme: string,
  configurationName: string,
  cwd: string = globalThis._constants.CALLER_WORKSPACE,
): string | null {
  const result = spawnSync(
    'xcodebuild',
    [
      '-workspace',
      workspacePath,
      '-scheme',
      scheme,
      '-configuration',
      configurationName,
      '-showBuildSettings',
    ],
    {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    },
  );

  if (result.error) return null;
  if (typeof result.status === 'number' && result.status !== 0) return null;

  return result.stdout || '';
}

export function inferMainAppTargetName(
  targets: PBXNativeTarget[],
  scheme: string,
  buildableNames: string[],
  xcodebuildSettings: XcodebuildTargetBuildSettings | null,
  appIdentifier?: string | null,
  project?: XcodeProject | null,
): string | null {
  const appTargets = targets.filter((target) => applicationTarget(target));
  if (appTargets.length === 0) return null;

  const envMatch = appTargets.find(
    (target) =>
      literalValue(
        xcodebuildSettings?.[target.props.name]?.PRODUCT_BUNDLE_IDENTIFIER,
      ) === literalValue(appIdentifier),
  );
  if (envMatch) return envMatch.props.name;

  const schemeMatch = appTargets.find((target) => target.props.name === scheme);
  if (schemeMatch) return schemeMatch.props.name;

  const buildableMatch = appTargets.find((target) =>
    buildableNames.includes(target.props.name),
  );
  if (buildableMatch) return buildableMatch.props.name;

  const packageMainTarget = project?.rootObject?.getMainAppTarget?.('ios');
  if (packageMainTarget && appTargets.includes(packageMainTarget)) {
    return packageMainTarget.props.name;
  }

  return appTargets.length === 1 ? appTargets[0].props.name : null;
}

export function getAvailableSchemes(
  iosDir: string,
  workspaceName: string,
): string[] {
  const schemes = new Set<string>();

  const scanDir = (dir: string) => {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.xcscheme')) {
            schemes.add(path.basename(file, '.xcscheme'));
          }
        }
      } catch {
        // ignore
      }
    }
  };

  // Shared schemes
  scanDir(
    path.join(
      iosDir,
      `${workspaceName}.xcworkspace`,
      'xcshareddata',
      'xcschemes',
    ),
  );
  scanDir(
    path.join(
      iosDir,
      `${workspaceName}.xcodeproj`,
      'xcshareddata',
      'xcschemes',
    ),
  );

  // User schemes
  const wsUserData = path.join(
    iosDir,
    `${workspaceName}.xcworkspace`,
    'xcuserdata',
  );
  if (fs.existsSync(wsUserData)) {
    try {
      for (const userDir of fs.readdirSync(wsUserData)) {
        scanDir(path.join(wsUserData, userDir, 'xcschemes'));
      }
    } catch {
      // ignore
    }
  }

  const projUserData = path.join(
    iosDir,
    `${workspaceName}.xcodeproj`,
    'xcuserdata',
  );
  if (fs.existsSync(projUserData)) {
    try {
      for (const userDir of fs.readdirSync(projUserData)) {
        scanDir(path.join(projUserData, userDir, 'xcschemes'));
      }
    } catch {
      // ignore
    }
  }

  // Fallback: xcodebuild -list
  if (schemes.size === 0) {
    try {
      const workspacePath = path.join(iosDir, `${workspaceName}.xcworkspace`);
      const projectPath = path.join(iosDir, `${workspaceName}.xcodeproj`);
      const args = fs.existsSync(workspacePath)
        ? ['-workspace', workspacePath, '-list', '-json']
        : ['-project', projectPath, '-list', '-json'];
      const result = spawnSync('xcodebuild', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (!result.error && result.stdout) {
        const parsed = JSON.parse(result.stdout);
        const list =
          parsed?.workspace?.schemes || parsed?.project?.schemes || [];
        for (const s of list) {
          if (s) schemes.add(String(s));
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(schemes).filter((name) => !name.startsWith('Pods-'));
}

export function resolveIosBundleIdentifiers(
  options: ResolveIosBundleIdentifiersOptions = {},
): ResolveIosBundleIdentifiersResult {
  const buildType = options.production ? 'PROD' : 'DEV';
  const envWorkspaceName =
    process.env.WORKSPACE_NAME || process.env[`WORKSPACE_NAME_${buildType}`];
  const envScheme = process.env.SCHEME || process.env[`SCHEME_${buildType}`];
  const envXcodeConfig =
    process.env.XCODE_CONFIGURATION ||
    process.env[`XCODE_CONFIGURATION_${buildType}`];
  const envAppId =
    (options.appIdentifier as string) ||
    process.env.APP_IDENTIFIER_IOS ||
    process.env[`APP_IDENTIFIER_IOS_${buildType}`] ||
    process.env.APP_IDENTIFIER ||
    process.env[`APP_IDENTIFIER_${buildType}`];

  const workspaceRoot = path.resolve(
    options.workspaceRoot || globalThis._constants.CALLER_WORKSPACE,
  );

  const iosDir = fs.existsSync(path.join(workspaceRoot, 'ios'))
    ? path.join(workspaceRoot, 'ios')
    : workspaceRoot;

  let workspaceName = options.workspaceName || envWorkspaceName;
  if (!workspaceName && fs.existsSync(iosDir)) {
    const entries = fs.readdirSync(iosDir);
    const workspaceFile = entries.find(
      (file) =>
        file.endsWith('.xcworkspace') &&
        !file.startsWith('.') &&
        file !== 'Pods.xcworkspace',
    );
    const projectFile = entries.find(
      (file) =>
        file.endsWith('.xcodeproj') &&
        !file.startsWith('.') &&
        file !== 'Pods.xcodeproj',
    );

    if (workspaceFile) {
      workspaceName = path.basename(workspaceFile, '.xcworkspace');
    } else if (projectFile) {
      workspaceName = path.basename(projectFile, '.xcodeproj');
    }
  }

  if (!workspaceName) {
    throw new Error(
      'WORKSPACE_NAME not found. Provide `--workspace-name` or define `WORKSPACE_NAME_DEV/PROD`.',
    );
  }

  const explicitScheme = options.scheme ? String(options.scheme).trim() : null;
  const available = getAvailableSchemes(iosDir, workspaceName);

  let schemeName: string;
  if (explicitScheme) {
    if (!available.includes(explicitScheme)) {
      const projShared = path.join(
        iosDir,
        `${workspaceName}.xcodeproj`,
        'xcshareddata',
        'xcschemes',
        `${explicitScheme}.xcscheme`,
      );
      const wsShared = path.join(
        iosDir,
        `${workspaceName}.xcworkspace`,
        'xcshareddata',
        'xcschemes',
        `${explicitScheme}.xcscheme`,
      );
      if (!fs.existsSync(projShared) && !fs.existsSync(wsShared)) {
        throw new Error(
          `Specified Xcode scheme not found: '${explicitScheme}'. Available schemes in project: ${
            available.length > 0 ? available.join(', ') : 'none'
          }`,
        );
      }
    }
    schemeName = explicitScheme;
  } else if (envScheme) {
    schemeName = envScheme;
  } else if (available.length > 0) {
    schemeName =
      available.find((s) => s === workspaceName) ||
      available.find((s) => !s.startsWith('Pods')) ||
      available[0];
  } else {
    schemeName = workspaceName;
  }

  const iosRoot =
    !fs.existsSync(path.join(workspaceRoot, `${workspaceName}.xcodeproj`)) &&
    fs.existsSync(path.join(workspaceRoot, 'ios', `${workspaceName}.xcodeproj`))
      ? path.join(workspaceRoot, 'ios')
      : workspaceRoot;

  const projectPath = path.join(
    iosRoot,
    `${workspaceName}.xcodeproj`,
    'project.pbxproj',
  );
  const workspacePath = path.join(iosRoot, `${workspaceName}.xcworkspace`);

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Xcode project not found: ${projectPath}`);
  }

  const project = XcodeProject.open(projectPath);
  let scheme: XCScheme | null = null;

  try {
    scheme = schemeName ? project.getScheme(schemeName) : null;
  } catch {
    scheme = null;
  }

  if (!scheme && schemeName) {
    const candidatePaths = [
      path.join(
        workspacePath,
        'xcshareddata',
        'xcschemes',
        `${schemeName}.xcscheme`,
      ),
      path.join(
        iosRoot,
        `${workspaceName}.xcodeproj`,
        'xcshareddata',
        'xcschemes',
        `${schemeName}.xcscheme`,
      ),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          scheme = XCScheme.open(p);
          break;
        } catch {
          // ignore
        }
      }
    }
  }

  if (!scheme && explicitScheme) {
    throw new Error(
      `Specified Xcode scheme not found or could not be opened: '${explicitScheme}'. Available schemes in project: ${
        available.length > 0 ? available.join(', ') : 'none'
      }`,
    );
  }

  // Fallback: try available schemes only if no explicit scheme was requested
  if (!scheme && !explicitScheme) {
    for (const alt of available) {
      try {
        const altScheme = project.getScheme(alt);
        if (altScheme) {
          scheme = altScheme;
          schemeName = alt;
          break;
        }
      } catch {
        // ignore
      }
      const altWsPath = path.join(
        workspacePath,
        'xcshareddata',
        'xcschemes',
        `${alt}.xcscheme`,
      );
      if (fs.existsSync(altWsPath)) {
        try {
          scheme = XCScheme.open(altWsPath);
          schemeName = alt;
          break;
        } catch {
          // ignore
        }
      }
    }
  }

  const allTargets = project.rootObject.props.targets.filter(
    (target): target is PBXNativeTarget => distributableTarget(target),
  );
  const buildableNames = (scheme?.props?.buildAction?.entries || [])
    .map((entry) => entry.buildableReference?.blueprintName)
    .filter((name): name is string => Boolean(name));
  const buildableTargets = allTargets.filter((target) =>
    buildableNames.includes(target.props.name),
  );
  const targets =
    buildableTargets.length > 0
      ? expandBuildableTargets(buildableTargets, allTargets)
      : allTargets;
  const configurationName = (options.configuration ||
    scheme?.props?.archiveAction?.buildConfiguration ||
    envXcodeConfig ||
    targets[0]?.props.buildConfigurationList?.props
      .defaultConfigurationName) as string;

  let xcodebuildSettings: XcodebuildTargetBuildSettings | null = null;
  if (
    targets.some((target) =>
      unresolvedReference(rawBundleIdentifier(target, configurationName)),
    )
  ) {
    xcodebuildSettings = parseXcodebuildBuildSettings(
      captureXcodebuildBuildSettings(
        workspacePath,
        schemeName,
        configurationName,
        workspaceRoot,
      ),
    );
  }

  const mainAppTargetName = inferMainAppTargetName(
    targets,
    schemeName,
    buildableNames,
    xcodebuildSettings,
    envAppId,
    project,
  );

  const results = targets.map((target) => {
    const rawBundleId = rawBundleIdentifier(target, configurationName);
    let bundleId: string | null = unresolvedReference(rawBundleId)
      ? null
      : literalValue(rawBundleId);

    let source: ConfigurationSource | null = bundleId ? 'build_settings' : null;

    if (!bundleId) {
      bundleId = literalValue(
        xcodebuildSettings?.[target.props.name]?.PRODUCT_BUNDLE_IDENTIFIER,
      );
      if (bundleId) source = 'xcodebuild';
    }

    if (!bundleId) {
      bundleId = literalValue(
        resolveXcconfigBundleIdentifier(
          project,
          target,
          configurationName,
          rawBundleId,
        ),
      );
      if (bundleId) source = 'xcconfig';
    }

    if (
      !bundleId &&
      target.props.name === mainAppTargetName &&
      literalValue(envAppId)
    ) {
      bundleId = literalValue(envAppId);
      source = 'env_fallback';
    }

    return {
      name: target.props.name,
      bundleId,
      productType: target.props.productType,
      configurationSource: source,
      rawBundleId,
      configuration: configurationName,
    };
  });

  const unresolvedTargets = results.filter((target) => !target.bundleId);
  if (unresolvedTargets.length > 0) {
    throw new Error(
      `Could not resolve PRODUCT_BUNDLE_IDENTIFIER. ${unresolvedTargets
        .map(
          (target) =>
            `Target=${target.name} ProductType=${target.productType} Configuration=${target.configuration} RawValue=${target.rawBundleId}`,
        )
        .join(' | ')}`,
    );
  }

  const mainTarget = results.find((t) => t.name === mainAppTargetName);
  const mainBundleId = mainTarget?.bundleId || results[0]?.bundleId || null;

  return {
    workspaceName,
    scheme: schemeName,
    configuration: configurationName,
    mainAppTargetName,
    bundle_id: mainBundleId,
    appIdentifier: mainBundleId,
    buildableNames,
    targets: results.map(
      ({ name, bundleId, productType, configurationSource }) => ({
        name,
        bundle_id: (bundleId || '') as string,
        productType,
        configurationSource,
      }),
    ),
    iosRoot,
  };
}

export interface GetIosIdentifiersOptions {
  workspaceRoot?: string;
  workspaceName?: string;
  scheme?: string;
  configuration?: string;
  production?: boolean;
}

/**
 * Check if an iOS project (.xcodeproj or .xcworkspace) exists in workspace
 */
export function hasIosProject(
  workspaceRoot: string = globalThis._constants.CALLER_WORKSPACE,
): boolean {
  const iosDir = path.join(workspaceRoot, 'ios');
  if (
    fs.existsSync(iosDir) &&
    fs
      .readdirSync(iosDir)
      .some(
        (f) =>
          (f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace')) &&
          !f.startsWith('.') &&
          f !== 'Pods.xcodeproj' &&
          f !== 'Pods.xcworkspace',
      )
  ) {
    return true;
  }

  if (fs.existsSync(workspaceRoot)) {
    return fs
      .readdirSync(workspaceRoot)
      .some(
        (f) =>
          (f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace')) &&
          !f.startsWith('.') &&
          f !== 'Pods.xcodeproj' &&
          f !== 'Pods.xcworkspace',
      );
  }

  return false;
}

/**
 * Detects workspace/project, resolves scheme, and extracts iOS bundle identifiers
 */
export function getIosIdentifiers(
  options: GetIosIdentifiersOptions = {},
): ResolveIosBundleIdentifiersResult {
  const workspaceRoot =
    options.workspaceRoot || globalThis._constants.CALLER_WORKSPACE;

  if (!hasIosProject(workspaceRoot)) {
    throw new Error(
      `iOS project not found (${path.join(workspaceRoot, 'ios')}).`,
    );
  }

  return resolveIosBundleIdentifiers({
    workspaceName: options.workspaceName,
    scheme: options.scheme,
    configuration: options.configuration,
    workspaceRoot,
    production: options.production,
  });
}
