import type Handlebars from 'handlebars';
import { readdir, readFile } from 'node:fs/promises';

export type HandlebarsTemplateDelegate<T = unknown> = Handlebars.TemplateDelegate<T>;
import { extname, join, basename } from 'node:path';
import { MissingTemplateError } from './errors';
import { createIsolatedHandlebars, parseTemplate, validateTemplateVariables } from './render';

interface CachedTemplate {
  delegate: HandlebarsTemplateDelegate;
  ast: hbs.AST.Program;
  source: string;
}

/**
 * In-memory template store providing compilation, caching, and fail-fast validation.
 */
export class TemplateStore {
  private readonly hbs: typeof Handlebars;
  private readonly templates = new Map<string, CachedTemplate>();

  constructor(hbsInstance?: typeof Handlebars) {
    this.hbs = hbsInstance ?? createIsolatedHandlebars();
  }

  /**
   * Registers and pre-compiles a template in memory.
   *
   * @param id Unique template identifier (e.g., 'welcome-email')
   * @param source Raw Handlebars template string
   * @throws {TemplateSyntaxError} If template source contains malformed syntax
   */
  register(id: string, source: string): void {
    const ast = parseTemplate(source, this.hbs);
    const delegate = this.hbs.compile(source);
    this.templates.set(id, { delegate, ast, source });
  }

  /**
   * Retrieves a pre-compiled template delegate by ID.
   *
   * @param id Template identifier
   * @throws {MissingTemplateError} If template ID is not registered
   */
  get(id: string): HandlebarsTemplateDelegate {
    const entry = this.templates.get(id);
    if (!entry) {
      throw new MissingTemplateError(id);
    }
    return entry.delegate;
  }

  /**
   * Checks whether a template ID is registered.
   *
   * @param id Template identifier
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * Removes a template from the store.
   *
   * @param id Template identifier
   * @returns True if the template was found and removed
   */
  delete(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Clears all registered templates from memory.
   */
  clear(): void {
    this.templates.clear();
  }

  /**
   * Renders a registered template with the provided data payload.
   * Validates that all required variables are present before execution.
   *
   * @param id Template identifier
   * @param data Variable interpolation payload
   * @returns Rendered template string
   * @throws {MissingTemplateError} If template ID is not registered
   * @throws {MissingVariableError} If a required variable is missing
   */
  render(id: string, data: Record<string, unknown>): string {
    const entry = this.templates.get(id);
    if (!entry) {
      throw new MissingTemplateError(id);
    }

    validateTemplateVariables(entry.ast, data, this.hbs, id);
    return entry.delegate(data);
  }

  /**
   * Loads and registers all template files from a local directory.
   *
   * @param dirPath Directory path to scan for templates
   * @param extension File extension filter (defaults to '.hbs')
   * @returns Number of templates loaded
   */
  async loadFromDirectory(dirPath: string, extension: string = '.hbs'): Promise<number> {
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
    const entries = await readdir(dirPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name);
        if (ext === normalizedExt) {
          const templateId = basename(entry.name, ext);
          const fullPath = join(dirPath, entry.name);
          const source = await readFile(fullPath, 'utf-8');
          this.register(templateId, source);
          count++;
        }
      }
    }

    return count;
  }
}
