import fs from 'node:fs';
import path from 'node:path';

export interface AndroidFlavor {
  name: string;
  applicationId?: string | null;
  applicationIdSuffix?: string | null;
}

export interface ResolveAndroidIdentifiersOptions {
  workspaceRoot?: string;
  production?: boolean;
  [key: string]: unknown;
}

export interface ResolveAndroidIdentifiersResult {
  androidRoot: string;
  appBuildGradlePath: string | null;
  manifestPath: string | null;
  namespace: string | null;
  applicationId: string | null;
  packageName: string | null;
  flavors: AndroidFlavor[];
}

export function findAndroidRoot(workspaceRoot?: string): string | null {
  const root = path.resolve(
    workspaceRoot || globalThis._constants.CALLER_WORKSPACE,
  );

  const candidates = [path.join(root, 'android'), root];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'app', 'build.gradle')) ||
      fs.existsSync(path.join(candidate, 'app', 'build.gradle.kts')) ||
      fs.existsSync(path.join(candidate, 'settings.gradle')) ||
      fs.existsSync(path.join(candidate, 'settings.gradle.kts'))
    ) {
      return candidate;
    }
  }

  return null;
}

export function parseAppBuildGradle(content: string): {
  namespace: string | null;
  applicationId: string | null;
  flavors: AndroidFlavor[];
} {
  let namespace: string | null = null;
  let applicationId: string | null = null;
  const flavors: AndroidFlavor[] = [];

  // Match namespace (e.g. namespace "com.app" or namespace = "com.app")
  const namespaceMatch = content.match(/namespace\s*=?\s*["']([^"']+)["']/);
  if (namespaceMatch) {
    namespace = namespaceMatch[1].trim();
  }

  // Match defaultConfig applicationId
  const defaultConfigMatch = content.match(/defaultConfig\s*\{([^}]+)\}/s);
  if (defaultConfigMatch) {
    const appIdMatch = defaultConfigMatch[1].match(
      /applicationId\s*=?\s*["']([^"']+)["']/,
    );
    if (appIdMatch) {
      applicationId = appIdMatch[1].trim();
    }
  }

  // Fallback: general applicationId
  if (!applicationId) {
    const appIdMatch = content.match(/applicationId\s*=?\s*["']([^"']+)["']/);
    if (appIdMatch) {
      applicationId = appIdMatch[1].trim();
    }
  }

  // Match product flavors if any
  const flavorsBlockMatch = content.match(
    /productFlavors\s*\{([\s\S]*?)\n\s*\}/,
  );
  if (flavorsBlockMatch) {
    const flavorBlock = flavorsBlockMatch[1];
    const flavorRegex =
      /(?:create\(\s*["']([^"']+)["']\s*\)|([a-zA-Z0-9_]+))\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = flavorRegex.exec(flavorBlock)) !== null) {
      const flavorName = match[1] || match[2];
      const flavorContent = match[3];
      const flavorAppIdMatch = flavorContent.match(
        /applicationId\s*=?\s*["']([^"']+)["']/,
      );
      const flavorSuffixMatch = flavorContent.match(
        /applicationIdSuffix\s*=?\s*["']([^"']+)["']/,
      );
      flavors.push({
        name: flavorName,
        applicationId: flavorAppIdMatch ? flavorAppIdMatch[1].trim() : null,
        applicationIdSuffix: flavorSuffixMatch
          ? flavorSuffixMatch[1].trim()
          : null,
      });
    }
  }

  return { namespace, applicationId, flavors };
}

export function parseAndroidManifest(content: string): {
  packageName: string | null;
} {
  const packageMatch = content.match(/package\s*=\s*["']([^"']+)["']/);
  return {
    packageName: packageMatch ? packageMatch[1].trim() : null,
  };
}

export function resolveAndroidIdentifiers(
  options: ResolveAndroidIdentifiersOptions = {},
): ResolveAndroidIdentifiersResult {
  const buildType = options.production ? 'PROD' : 'DEV';
  const fallbackEnvAppId =
    (options.appIdentifier as string) ||
    process.env.APP_IDENTIFIER_ANDROID ||
    process.env[`APP_IDENTIFIER_ANDROID_${buildType}`] ||
    process.env.APP_IDENTIFIER ||
    process.env[`APP_IDENTIFIER_${buildType}`];

  const workspaceRoot = path.resolve(
    options.workspaceRoot || globalThis._constants.CALLER_WORKSPACE,
  );

  const androidRoot = findAndroidRoot(workspaceRoot);
  if (!androidRoot) {
    throw new Error(
      `Android project not found (${path.join(workspaceRoot, 'android')}).`,
    );
  }

  // Find app/build.gradle or app/build.gradle.kts
  let appBuildGradlePath: string | null = null;
  const gradleCandidates = [
    path.join(androidRoot, 'app', 'build.gradle'),
    path.join(androidRoot, 'app', 'build.gradle.kts'),
  ];
  for (const candidate of gradleCandidates) {
    if (fs.existsSync(candidate)) {
      appBuildGradlePath = candidate;
      break;
    }
  }

  let namespace: string | null = null;
  let applicationId: string | null = null;
  let flavors: AndroidFlavor[] = [];

  if (appBuildGradlePath) {
    const gradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
    const parsed = parseAppBuildGradle(gradleContent);
    namespace = parsed.namespace;
    applicationId = parsed.applicationId;
    flavors = parsed.flavors;
  }

  // Find AndroidManifest.xml
  let manifestPath: string | null = null;
  const manifestCandidates = [
    path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml'),
    path.join(androidRoot, 'src', 'main', 'AndroidManifest.xml'),
  ];
  for (const candidate of manifestCandidates) {
    if (fs.existsSync(candidate)) {
      manifestPath = candidate;
      break;
    }
  }

  let packageName: string | null = null;
  if (manifestPath) {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const parsedManifest = parseAndroidManifest(manifestContent);
    packageName = parsedManifest.packageName;
  }

  // If namespace is missing, fallback to packageName or applicationId
  if (!namespace) {
    namespace = packageName || applicationId;
  }

  // If packageName is missing, fallback to namespace
  if (!packageName) {
    packageName = namespace;
  }

  // If applicationId is missing, fallback to namespace or packageName or env
  if (!applicationId) {
    applicationId =
      namespace ||
      packageName ||
      (fallbackEnvAppId ? fallbackEnvAppId.trim() : null);
  }

  return {
    androidRoot,
    appBuildGradlePath,
    manifestPath,
    namespace,
    applicationId,
    packageName,
    flavors,
  };
}

export interface GetAndroidIdentifiersOptions {
  workspaceRoot?: string;
  production?: boolean;
}

/**
 * Check if an Android project exists in workspace
 */
export function hasAndroidProject(
  workspaceRoot: string = globalThis._constants.CALLER_WORKSPACE,
): boolean {
  return Boolean(findAndroidRoot(workspaceRoot));
}

/**
 * Resolves Android applicationId, namespace, and flavors
 */
export function getAndroidIdentifiers(
  options: GetAndroidIdentifiersOptions = {},
): ResolveAndroidIdentifiersResult {
  const workspaceRoot =
    options.workspaceRoot || globalThis._constants.CALLER_WORKSPACE;

  const androidRoot = findAndroidRoot(workspaceRoot);
  if (!androidRoot) {
    throw new Error(
      `Android project not found (${path.join(workspaceRoot, 'android')}).`,
    );
  }

  return resolveAndroidIdentifiers({
    workspaceRoot,
    production: options.production,
  });
}
