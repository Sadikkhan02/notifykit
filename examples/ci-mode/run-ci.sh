#!/usr/bin/env bash
set -euo pipefail

echo "=== NotifyKit CI Setup Wizard (Non-Interactive / Dry-Run) ==="

# Execute non-interactive CLI wizard with --dry-run to verify zero credential leakage
npx notifykit init \
  --channels=email,sms \
  --email=nodemailer \
  --sms=twilio \
  --smtp-host=smtp.mailtrap.io \
  --smtp-port=587 \
  --smtp-user=mock_ci_user \
  --smtp-password=mock_ci_pass \
  --twilio-sid=AC00000000000000000000000000000000 \
  --twilio-token=mock_ci_token \
  --twilio-from=+15555550100 \
  --dry-run \
  --skip-install \
  --yes

echo "=== Non-Interactive CI Setup Completed Successfully ==="
