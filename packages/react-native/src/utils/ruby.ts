import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { spawnSync } from "node:child_process";
import pc from "picocolors";
import { spinner } from "@clack/prompts";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bulletproof pkgRoot detection (works whether bundled in dist/, or unbundled in src/utils/)
const pkgRoot = fs.existsSync(path.join(__dirname, "../package.json"))
  ? path.join(__dirname, "../")
  : fs.existsSync(path.join(__dirname, "package.json"))
    ? __dirname
    : path.join(__dirname, "../../");

const libDir = path.join(os.homedir(), ".cmd-bin", "lib");
const rubyDir = path.join(libDir, "ruby");

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Node.js" } }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          downloadFile(response.headers.location!, dest)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlink(dest, () => reject(err));
        });
      })
      .on("error", reject);
  });
}

function getRubyAssetPlatform(): string {
  const platform = process.platform;
  const arch = process.arch;

  // jdx/ruby provides a unified macos binary (ruby-3.4.8.macos.tar.gz)
  if (platform === "darwin") return "macos";
  if (platform === "linux" && arch === "x64") return "x86_64_linux";
  if (platform === "linux" && arch === "arm64") return "arm64_linux";

  throw new Error(
    `Unsupported OS/Arch combination for portable Ruby: ${platform} ${arch}`,
  );
}

function getSystemRubyVersion(): string | null {
  try {
    const res = spawnSync("ruby", ["-v"], { encoding: "utf-8" });
    if (res.status === 0) {
      const match = res.stdout.match(/^ruby (\d+\.\d+\.\d+)/);
      if (match) return match[1];
    }
  } catch {
    // Ignore if ruby is not installed
  }
  return null;
}

function isRubyCompatible(version: string): boolean {
  const parts = version.split(".").map(Number);
  // ^3.4 compatibility: major must be 3, minor must be >= 4
  return parts[0] === 3 && parts[1] >= 4;
}

export async function ensureRubyEnvironment(
  baseEnv: Record<string, string | undefined>,
  silent: boolean = false,
): Promise<Record<string, string | undefined>> {
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  // jdx/ruby extracts to ruby-3.4.8/bin
  const rubyBinDir = path.join(rubyDir, "ruby-3.4.8", "bin");

  // 1. Highest priority: if lib/ruby/ruby-3.4.8/bin exists, use it!
  if (fs.existsSync(rubyBinDir)) {
    const currentPath = baseEnv.PATH || process.env.PATH || "";
    return {
      ...baseEnv,
      PATH: `${rubyBinDir}${path.delimiter}${currentPath}`,
      MISE_DISABLE: "1", // Prevent mise from hijacking PATH in child shells
    };
  }

  // 2. Next priority: check if global system ruby is compatible
  // const systemVersion = getSystemRubyVersion();
  // if (systemVersion && isRubyCompatible(systemVersion)) {
  //   // System ruby is already compatible, no need to download portable ruby
  //   return baseEnv;
  // }

  // 3. Fallback: download truly portable ruby from jdx/ruby
  let s;
  if (!silent) {
    s = spinner();
    s.start(pc.cyan("Downloading static Portable Ruby 3.4.8..."));
  }

  const assetPlatform = getRubyAssetPlatform();
  // Deterministic URL for jdx/ruby releases
  const downloadUrl = `https://github.com/jdx/ruby/releases/download/3.4.8-4/ruby-3.4.8.${assetPlatform}.tar.gz`;

  const tarballPath = path.join(libDir, "ruby.tar.gz");
  await downloadFile(downloadUrl, tarballPath);

  if (!silent && s) s.message(pc.cyan("Extracting static Ruby..."));
  fs.mkdirSync(rubyDir, { recursive: true });

  // Extract using system tar
  const ext = spawnSync("tar", ["-xzf", tarballPath, "-C", rubyDir]);
  if (ext.status !== 0) {
    if (!silent && s) s.stop(pc.red("Failed to extract portable Ruby."));
    process.exit(1);
  }

  fs.unlinkSync(tarballPath);

  // // Shebang fix is no longer strictly necessary since jdx/ruby uses standard #!/usr/bin/env ruby
  // // But we can keep a simpler version just in case
  // const binFiles = fs.readdirSync(rubyBinDir);
  // for (const file of binFiles) {
  //   const filePath = path.join(rubyBinDir, file);
  //   if (fs.statSync(filePath).isFile()) {
  //     const content = fs.readFileSync(filePath, "utf8");
  //     if (
  //       content.startsWith("#!") &&
  //       content.includes("/ruby") &&
  //       !content.includes("env ruby")
  //     ) {
  //       const fixedContent = content.replace(
  //         /^#!.*?ruby/,
  //         "#!/usr/bin/env ruby",
  //       );
  //       fs.writeFileSync(filePath, fixedContent, {
  //         encoding: "utf8",
  //         mode: fs.statSync(filePath).mode,
  //       });
  //     }
  //   }
  // }

  if (!silent && s)
    s.stop(pc.green("Static Portable Ruby installed successfully."));

  // Prepend rubyBinDir to PATH so bundle and fastlane commands use it natively
  const currentPath = baseEnv.PATH || process.env.PATH || "";
  return {
    ...baseEnv,
    PATH: `${rubyBinDir}${path.delimiter}${currentPath}`,
    MISE_DISABLE: "1", // Prevent mise from hijacking PATH in child shells
  };
}
