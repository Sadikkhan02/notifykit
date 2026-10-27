# `notifykit-cli`

Interactive setup wizard and non-interactive CI tool for configuring **NotifyKit** in any Node.js project.

## Quick Start

Run the wizard in your project root:

```bash
npx notifykit init
```

The wizard will guide you through:

1. Selecting notification channels (**Email**, **SMS**, **Push**)
2. Selecting provider adapters:
   - **Email:** Nodemailer (Universal SMTP / Mailtrap / Gmail / SES)
   - **SMS:** Twilio (Global reach) or MSG91 (India-optimized, DLT compliant)
   - **Push:** Firebase Cloud Messaging (Android, iOS, Web)
3. Configuring Redis queue connectivity (local, Docker, or cloud)
4. Capturing provider credentials with masked password inputs
5. Reviewing a summary before making changes
6. Merge-safe writing of `.env` and `.env.example`
7. Automatically installing only the selected adapter packages and peer SDKs

---

## Non-Interactive / CI/CD Usage

For automated environments, Docker containers, and CI/CD pipelines, specify configuration flags with `--yes`:

```bash
# Configure Twilio SMS
npx notifykit init \
  --channels=sms \
  --sms=twilio \
  --twilio-sid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --twilio-token=your_auth_token \
  --twilio-from=+1234567890 \
  --yes

# Configure Nodemailer Email with dry-run
npx notifykit init \
  --channels=email \
  --email=nodemailer \
  --smtp-host=smtp.mailtrap.io \
  --smtp-port=587 \
  --smtp-user=my_user \
  --smtp-password=my_secret \
  --dry-run \
  --yes
```

---

## Command-Line Options

| Option                   | Type    | Description                                                          |
| :----------------------- | :------ | :------------------------------------------------------------------- |
| `-y, --yes`              | Boolean | Confirm actions non-interactively (required in non-TTY environments) |
| `--dry-run`              | Boolean | Preview configuration without modifying files or installing packages |
| `--skip-install`         | Boolean | Write `.env` without executing package manager installation          |
| `--cwd <path>`           | String  | Target directory (defaults to `process.cwd()`)                       |
| `--package-manager <pm>` | String  | Force package manager (`npm`, `pnpm`, `yarn`, `bun`)                 |
| `-h, --help`             | Boolean | Display help screen                                                  |
| `-v, --version`          | Boolean | Display version                                                      |

### Channel & Provider Flags

| Flag          | Values                 | Description                                                 |
| :------------ | :--------------------- | :---------------------------------------------------------- |
| `--channels`  | `email`, `sms`, `push` | Comma-separated list of channels to configure               |
| `--email`     | `nodemailer`           | Email provider selection                                    |
| `--sms`       | `twilio`, `msg91`      | SMS provider selection                                      |
| `--push`      | `fcm`                  | Push provider selection                                     |
| `--redis-url` | URL string             | Redis connection string (default: `redis://localhost:6379`) |

### Provider Credential Flags

- **Nodemailer:** `--smtp-host`, `--smtp-port`, `--smtp-user`, `--smtp-password`, `--smtp-from`, `--smtp-secure`
- **Twilio:** `--twilio-sid`, `--twilio-token`, `--twilio-from`, `--twilio-messaging-service-sid`
- **MSG91:** `--msg91-auth-key`, `--msg91-flow-id`, `--msg91-sender-id`
- **FCM:** `--fcm-service-account`, `--fcm-project-id`

---

## Security & Merge Safety

- **Zero Secret Leakage:** Sensitive tokens and passwords are never logged to `stdout`, `stderr`, or terminal diagnostics.
- **Merge-Safe `.env` Updates:** Unrelated variables (such as `DATABASE_URL` or `PORT`), blank lines, and comments are 100% preserved.
- **Safe `.env.example` Generation:** Places example placeholders in `.env.example` without exposing real credentials.
- **Shell Injection Prevention:** Package manager commands pass discrete argument arrays directly to `execa`, avoiding raw shell command concatenation.
- **Idempotent:** Re-running the wizard updates existing NotifyKit keys without duplicating sections.

---

## License

MIT
