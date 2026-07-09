# @cmd-bin/react-native

Modern, minimalist CLI toolkit for React Native development. Built for
high-performance execution.

---

## 🚀 Usage (CLI)

You can run the toolkit directly without any installation via `npx`:

```bash
npx @cmd-bin/react-native status
```

---

## 🛠 Available Commands

### `init`

Initialize necessary files and configurations for the project. Creates `.env.deploy`, `.tool-versions` (node/ruby), and updates `.gitignore`.

```bash
npx @cmd-bin/react-native init
```

### `run <...fastlaneArgs>`

Execute Fastlane commands within the configured Ruby environment.

- `-p, --production`: Use production environment variables (`_PROD` suffix)
- `--clean`: Clean build directories (android/ios) before execution

```bash
npx @cmd-bin/react-native run ios internal
npx @cmd-bin/react-native run android adhoc
npx @cmd-bin/react-native run --clean -p ios internal
```

### `bundle [...bundleArgs]`

Execute Ruby bundler commands directly within the isolated Fastlane environment.

```bash
npx @cmd-bin/react-native bundle install
npx @cmd-bin/react-native bundle update fastlane
```

### `clean`

Remove generated build artifacts and clear caches.

- `--platform <type>`: Specify which platform's build directories to clean (`android` | `ios` | `all`)
- `--vendor`: Remove vendor bundle directory (`~/.cmd-bin/react-native/vendor/bundle`)
- `--outputs`: Remove lane outputs directory (`~/.cmd-bin/react-native/lane-outputs`)
- `--derived-data`: Remove iOS derived data directory (`~/.cmd-bin/react-native/ios/derived-data`)

```bash
npx @cmd-bin/react-native clean
npx @cmd-bin/react-native clean --platform android
npx @cmd-bin/react-native clean --vendor --outputs --derived-data
```

### `status`

Displays the current version of the toolkit and identifies the active runtime environment.

```bash
npx @cmd-bin/react-native status
```

### Global Options

- **`--help`**: Displays the help menu with all available commands and options.
- **`--version`**: Shows the current version of the CLI.

---

## ✨ Features

- **TypeScript**: Developed entirely in TypeScript, providing full type safety and reliability.
- **Minimalist Core**: Built with [CAC](https://github.com/cacjs/cac) for
  near-instant startup times and zero unnecessary overhead.
- **Isolated Fastlane Environment**: Manages Bundler dependencies and paths independently, ensuring Fastlane runs consistently without polluting the global Ruby environment.

---

## 📄 License

[Apache-2.0](LICENSE)
