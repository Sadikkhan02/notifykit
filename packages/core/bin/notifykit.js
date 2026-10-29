#!/usr/bin/env node
import { main } from 'notifykit-cli';

main()
  .then((code) => {
    if (typeof code === 'number' && code !== 0) {
      process.exit(code);
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error during NotifyKit setup:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
