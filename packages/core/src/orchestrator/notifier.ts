import { loadConfig } from '../config/loader.js';
import { validateConfig } from '../config/validator.js';
import { NotifyKitError } from '../errors/notifykit-error.js';
import type { NotifierConfig } from '../interfaces/config.js';
import type { NotificationEvent } from '../interfaces/event.js';
import { getLogger, type Logger } from '../logging/logger.js';
import type { QueueRegistry } from '../queue/registry.js';
import { WorkerManager, type StartWorkerOptions } from '../queue/worker.js';
import { TemplateStore } from '../templates/store.js';
import { notify, type NotifyResult } from './notify.js';

export interface CreateNotifierOptions {
  redis?: string;
  providers?: NotifierConfig['providers'];
  templates?: Record<string, string>;
  templateDir?: string;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  logger?: Logger;
  config?: Partial<NotifierConfig>;
  registry?: QueueRegistry;
}

export interface Notifier {
  /**
   * Enqueues a notification event across all requested delivery channels.
   * Renders the registered template fail-fast and pushes durably to Redis queues.
   */
  notify(event: NotificationEvent): Promise<NotifyResult>;

  /**
   * Registers a Handlebars template in the in-memory template store.
   */
  registerTemplate(id: string, source: string): void;

  /**
   * Starts BullMQ worker processors for configured delivery channels.
   * Synchronous validation; initiates background cleanup if construction fails mid-loop.
   */
  startWorker(opts?: StartWorkerOptions): void;

  /**
   * Gracefully shuts down all workers owned by this notifier instance, draining active in-flight jobs.
   */
  stopWorker(): Promise<void>;
}

/**
 * Creates and configures a Notifier instance.
 *
 * Implements the core orchestrator factory per PRD §10.1 and PHASES.md §10 line 2770:
 * Returns { notify, registerTemplate, startWorker }.
 *
 * Clean shutdown is achieved through existing Phase 3 lifecycle functions:
 * import { resetDefaultRegistry, closeRedisConnection } from 'notifykit';
 * await resetDefaultRegistry();
 * await closeRedisConnection();
 */
export function createNotifier(options?: CreateNotifierOptions): Notifier {
  const baseConfig = loadConfig();
  const mergedConfig: NotifierConfig = {
    redis: options?.redis ?? options?.config?.redis ?? baseConfig.redis,
    providers: {
      ...baseConfig.providers,
      ...options?.config?.providers,
      ...options?.providers,
    },
  };

  const validatedConfig = validateConfig(mergedConfig);
  const logger = options?.logger ?? getLogger(options?.logLevel);
  const templateStore = new TemplateStore();

  if (options?.templates) {
    for (const [id, source] of Object.entries(options.templates)) {
      templateStore.register(id, source);
    }
  }

  const workerManager = new WorkerManager({
    config: validatedConfig,
    registry: options?.registry,
    logger,
  });

  return {
    async notify(event: NotificationEvent): Promise<NotifyResult> {
      return notify(event, {
        config: validatedConfig,
        registry: options?.registry,
        templateStore,
        logger,
      });
    },

    registerTemplate(id: string, source: string): void {
      templateStore.register(id, source);
    },

    startWorker(opts?: StartWorkerOptions): void {
      workerManager.start(opts);
    },

    async stopWorker(): Promise<void> {
      await workerManager.stop();
    },
  };
}
