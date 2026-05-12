# @cmd-bin/react-native

Modern, minimalist CLI toolkit for React Native development. Built for
high-performance execution across **Bun**, **Deno**, and **Node.js**.

---

## 🚀 Usage (CLI)

You can run the toolkit directly without any installation using your favorite
runtime.

### Using Bun

```bash
bunx --bun @cmd-bin/react-native status
```

### Using Deno

```bash
deno x jsr:@cmd-bin/react-native status
```

### Using Node.js
```bash
npx @cmd-bin/react-native status
```

---

## 🛠 Available Commands

- **`status`**: Displays the current version of the toolkit and identifies the
  active runtime environment (Bun, Node, or Deno).
- **`--help`**: Displays the help menu with all available commands and options.
- **`--version`**: Shows the current version of the CLI.

---

## ✨ Features

- **Pure TypeScript**: No build step required. Leverages modern runtime support
  for direct TS execution.
- **Minimalist Core**: Built with [CAC](https://github.com/cacjs/cac) for
  near-instant startup times and zero unnecessary overhead.
- **Cross-Runtime**: Identical behavior and performance across Bun, Deno, and
  Node.js.

---

## 📄 License

[Apache-2.0](LICENSE)
