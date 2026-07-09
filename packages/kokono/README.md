# @cmd-bin/kokono

A command-line interface tool for sending secure, end-to-end encrypted notifications via KokoNo.

## Usage

You can run this CLI tool without installing it by using `npx`:

```bash
npx @cmd-bin/kokono --token="<YOUR_TOKEN>" --title="Hello" --message="World"
```

### Options

| Option                | Description                      | Required |
| --------------------- | -------------------------------- | -------- |
| `--token <token>`     | Authentication token             | **Yes**  |
| `--title <title>`     | Notification title               | No*      |
| `--message <message>` | Notification message             | No*      |
| `--e2e <publicKey>`   | End-to-End Encryption public key | No       |

_\* Note: If `--e2e` is provided, both `--title` and `--message` become required._

### End-to-End Encryption (E2E)

When the `--e2e` flag is used with a valid base64-encoded X25519 public key, the payload (title and message) will be encrypted locally on your machine using ECIES (Curve25519) and AES-256-GCM before being sent to the server. The server will not be able to read the contents of your notification.

**Example with E2E:**

```bash
npx @cmd-bin/kokono \
  --token="<YOUR_TOKEN>" \
  --title="Secret Title" \
  --message="Secret Message" \
  --e2e="<BASE64_PUBLIC_KEY>"
```
