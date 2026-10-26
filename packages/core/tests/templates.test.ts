import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  renderTemplate,
  TemplateStore,
  uppercase,
  formatDate,
  MissingTemplateError,
  MissingVariableError,
  TemplateSyntaxError,
  NotifyKitError,
} from '../src/index';
import { createIsolatedHandlebars, resolvePath, isFalsy } from '../src/templates/render';

describe('Template Engine (Phase 2)', () => {
  describe('Standalone renderTemplate', () => {
    it('TC-TPL-01: renders simple variable substitution', () => {
      const output = renderTemplate('Hello, {{name}}!', { name: 'John' });
      expect(output).toBe('Hello, John!');
    });

    it('TC-TPL-02: resolves multiple variables and nested object paths', () => {
      const template = 'User: {{user.firstName}} {{user.lastName}} ({{user.contact.email}})';
      const data = {
        user: {
          firstName: 'Jane',
          lastName: 'Doe',
          contact: { email: 'jane@example.com' },
        },
      };
      const output = renderTemplate(template, data);
      expect(output).toBe('User: Jane Doe (jane@example.com)');
    });

    it('TC-TPL-03: built-in uppercase helper transforms strings and handles edge cases', () => {
      expect(uppercase('hello')).toBe('HELLO');
      expect(uppercase(null)).toBe('');
      expect(uppercase(undefined)).toBe('');
      expect(uppercase(123)).toBe('123');

      const output = renderTemplate('WELCOME {{uppercase name}}!', {
        name: 'alice',
      });
      expect(output).toBe('WELCOME ALICE!');
    });

    it('TC-TPL-04: built-in formatDate helper formats dates correctly', () => {
      const fixedDate = new Date('2026-10-25T12:00:00.000Z');

      expect(formatDate(fixedDate, 'iso')).toBe('2026-10-25T12:00:00.000Z');
      expect(formatDate(fixedDate, 'date')).toBe('2026-10-25');
      expect(formatDate(fixedDate)).toBe('2026-10-25');
      expect(formatDate(fixedDate.getTime(), 'date')).toBe('2026-10-25');
      expect(formatDate('2026-10-25T12:00:00.000Z', 'utc')).toContain('2026');
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('invalid-date')).toBe('');

      const output = renderTemplate('Created on: {{formatDate createdAt "iso"}}', {
        createdAt: fixedDate,
      });
      expect(output).toBe('Created on: 2026-10-25T12:00:00.000Z');
    });

    it('TC-TPL-05: throws MissingVariableError on missing top-level variable', () => {
      expect(() => renderTemplate('Hello, {{name}}!', {})).toThrowError(MissingVariableError);

      try {
        renderTemplate('Hello, {{name}}!', {}, 'welcome-tpl');
      } catch (err) {
        expect(err).toBeInstanceOf(MissingVariableError);
        expect(err).toBeInstanceOf(NotifyKitError);
        const mErr = err as MissingVariableError;
        expect(mErr.code).toBe('E_MISSING_VARIABLE');
        expect(mErr.variableName).toBe('name');
        expect(mErr.templateId).toBe('welcome-tpl');
        expect(mErr.message).toContain('"name"');
        expect(mErr.message).toContain('welcome-tpl');
        expect(mErr.hint).toContain('Provide "name"');
      }
    });

    it('TC-TPL-06: throws MissingVariableError on missing nested paths', () => {
      // 1. Parent object completely missing
      expect(() => renderTemplate('City: {{user.address.city}}', {})).toThrowError(
        MissingVariableError,
      );

      // 2. Intermediate object missing
      expect(() => renderTemplate('City: {{user.address.city}}', { user: {} })).toThrowError(
        MissingVariableError,
      );

      // 3. Leaf property missing
      try {
        renderTemplate('City: {{user.address.city}}', {
          user: { address: {} },
        });
      } catch (err) {
        expect(err).toBeInstanceOf(MissingVariableError);
        const mErr = err as MissingVariableError;
        expect(mErr.code).toBe('E_MISSING_VARIABLE');
        expect(mErr.variableName).toBe('user.address.city');
      }
    });

    it('TC-TPL-09: throws TemplateSyntaxError on malformed syntax', () => {
      // Unclosed tag
      expect(() => renderTemplate('Hello, {{name', { name: 'John' })).toThrow(TemplateSyntaxError);

      // Mismatched blocks
      try {
        renderTemplate('{{#if test}}Hello{{/unless}}', { test: true });
      } catch (err) {
        expect(err).toBeInstanceOf(TemplateSyntaxError);
        expect(err).toBeInstanceOf(NotifyKitError);
        const sErr = err as TemplateSyntaxError;
        expect(sErr.code).toBe('E_TEMPLATE_SYNTAX');
        expect(sErr.hint).toContain('Check template syntax');
        expect(sErr.cause).toBeDefined();
      }
    });

    it('TC-TPL-13: preserves explicit boolean and falsy values without error', () => {
      // Explicit false in conditional
      const ifOutput = renderTemplate('{{#if hasDiscount}}Discounted{{else}}Regular{{/if}}', {
        hasDiscount: false,
      });
      expect(ifOutput).toBe('Regular');

      // Explicit false in #unless
      const unlessOutput = renderTemplate(
        '{{#unless isBlocked}}Allowed{{else}}Blocked{{/unless}}',
        { isBlocked: false },
      );
      expect(unlessOutput).toBe('Allowed');

      // Explicit values in output interpolation: 0, false, null, empty string
      expect(renderTemplate('Count: {{count}}', { count: 0 })).toBe('Count: 0');
      expect(renderTemplate('Active: {{active}}', { active: false })).toBe('Active: false');
      expect(renderTemplate('Empty: {{empty}}', { empty: '' })).toBe('Empty: ');
      expect(renderTemplate('Null: {{val}}', { val: null })).toBe('Null: ');
    });

    it('TC-TPL-14: Option B — absent conditional properties evaluate as falsy without throwing', () => {
      // 1. Absent property in #if evaluates as falsy
      const ifResult = renderTemplate(
        '{{#if hasDiscount}}Discount: {{rate}}%{{else}}Standard pricing{{/if}}',
        {}, // hasDiscount absent, rate absent
      );
      expect(ifResult).toBe('Standard pricing');

      // 2. Absent property in #unless evaluates as falsy, selecting body
      const unlessResult = renderTemplate(
        '{{#unless isSubscribed}}Please subscribe!{{else}}Welcome back!{{/unless}}',
        {}, // isSubscribed absent
      );
      expect(unlessResult).toBe('Please subscribe!');

      // 3. When condition IS truthy, missing variable in active branch throws
      expect(() =>
        renderTemplate(
          '{{#if hasDiscount}}Discount: {{rate}}%{{else}}Standard pricing{{/if}}',
          { hasDiscount: true }, // rate missing
        ),
      ).toThrowError(MissingVariableError);

      // 4. When condition is falsy, missing variable in inactive branch does NOT throw
      const inactiveResult = renderTemplate(
        '{{#if hasDiscount}}Discount: {{rate}}%{{else}}Standard pricing: {{tier}}{{/if}}',
        { hasDiscount: false, tier: 'Basic' }, // rate missing, but in inactive branch
      );
      expect(inactiveResult).toBe('Standard pricing: Basic');
    });

    it('supports #each and #with blocks with variable validation', () => {
      // #each with items
      const eachOutput = renderTemplate('Items:{{#each items}} {{name}}{{/each}}', {
        items: [{ name: 'A' }, { name: 'B' }],
      });
      expect(eachOutput).toBe('Items: A B');

      // #each with empty array and else branch
      const eachEmptyOutput = renderTemplate(
        'Items:{{#each items}} {{name}}{{else}} None{{/each}}',
        { items: [] },
      );
      expect(eachEmptyOutput).toBe('Items: None');

      // #each with missing collection throws
      expect(() => renderTemplate('{{#each items}}{{name}}{{/each}}', {})).toThrowError(
        MissingVariableError,
      );

      // #with block
      const withOutput = renderTemplate('{{#with profile}}Email: {{email}}{{/with}}', {
        profile: { email: 'test@example.com' },
      });
      expect(withOutput).toBe('Email: test@example.com');

      // #with block with missing variable throws
      expect(() => renderTemplate('{{#with profile}}Email: {{email}}{{/with}}', {})).toThrowError(
        MissingVariableError,
      );
    });

    it('validates subexpressions inside helpers', () => {
      const template = 'Date: {{uppercase (formatDate createdAt "iso")}}';
      const now = new Date('2026-10-25T10:00:00.000Z');
      expect(renderTemplate(template, { createdAt: now })).toBe('Date: 2026-10-25T10:00:00.000Z');

      // Missing subexpression param throws
      expect(() => renderTemplate(template, {})).toThrowError(MissingVariableError);
    });
  });

  describe('TemplateStore', () => {
    let store: TemplateStore;
    let tempDir: string;

    beforeEach(async () => {
      store = new TemplateStore();
      tempDir = await mkdtemp(join(tmpdir(), 'notifykit-tpl-test-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('TC-TPL-07: get() throws MissingTemplateError for unregistered template', () => {
      expect(() => store.get('nonexistent')).toThrowError(MissingTemplateError);
      try {
        store.get('nonexistent');
      } catch (err) {
        expect(err).toBeInstanceOf(MissingTemplateError);
        expect(err).toBeInstanceOf(NotifyKitError);
        const tErr = err as MissingTemplateError;
        expect(tErr.code).toBe('E_MISSING_TEMPLATE');
        expect(tErr.templateId).toBe('nonexistent');
        expect(tErr.hint).toContain('notifier.registerTemplate');
      }
    });

    it('TC-TPL-08: render() throws MissingTemplateError for unregistered template', () => {
      expect(() => store.render('nonexistent', {})).toThrowError(MissingTemplateError);
    });

    it('TC-TPL-10: supports lifecycle operations (register, has, get, delete, clear)', () => {
      expect(store.has('welcome')).toBe(false);

      store.register('welcome', 'Hello, {{name}}!');
      expect(store.has('welcome')).toBe(true);
      expect(store.get('welcome')).toBeDefined();

      const output = store.render('welcome', { name: 'Bob' });
      expect(output).toBe('Hello, Bob!');

      expect(store.delete('welcome')).toBe(true);
      expect(store.has('welcome')).toBe(false);
      expect(store.delete('welcome')).toBe(false);

      store.register('t1', '1');
      store.register('t2', '2');
      expect(store.has('t1')).toBe(true);
      expect(store.has('t2')).toBe(true);

      store.clear();
      expect(store.has('t1')).toBe(false);
      expect(store.has('t2')).toBe(false);
    });

    it('TC-TPL-11: template caching pre-compiles and reuses delegate', () => {
      store.register('cached', 'Count: {{count}}');
      const delegate1 = store.get('cached');
      const delegate2 = store.get('cached');
      expect(delegate1).toBe(delegate2);

      const render1 = store.render('cached', { count: 1 });
      const render2 = store.render('cached', { count: 2 });
      expect(render1).toBe('Count: 1');
      expect(render2).toBe('Count: 2');
    });

    it('TC-TPL-12: loadFromDirectory loads .hbs files from disk', async () => {
      await writeFile(join(tempDir, 'welcome.hbs'), 'Welcome, {{user}}!');
      await writeFile(join(tempDir, 'reset.hbs'), 'Reset code: {{code}}');
      await writeFile(join(tempDir, 'ignore.txt'), 'Not a template');
      await mkdir(join(tempDir, 'subfolder'));

      // Test without leading dot
      const count = await store.loadFromDirectory(tempDir, 'hbs');
      expect(count).toBe(2);
      expect(store.has('welcome')).toBe(true);
      expect(store.has('reset')).toBe(true);
      expect(store.has('ignore')).toBe(false);

      expect(store.render('welcome', { user: 'Alice' })).toBe('Welcome, Alice!');
      expect(store.render('reset', { code: '123456' })).toBe('Reset code: 123456');
    });

    it('throws TemplateSyntaxError on registering malformed template in store', () => {
      expect(() => store.register('bad', 'Hello, {{name')).toThrowError(TemplateSyntaxError);
    });

    it('supports custom Handlebars instance in TemplateStore', () => {
      const customHbs = createIsolatedHandlebars();
      const customStore = new TemplateStore(customHbs);
      customStore.register('hello', 'Hi {{name}}');
      expect(customStore.render('hello', { name: 'World' })).toBe('Hi World');
    });
  });

  describe('Edge-case & internal utilities coverage', () => {
    it('handles resolvePath with non-object or null input', () => {
      expect(resolvePath(null, 'foo')).toEqual({ found: false });
      expect(resolvePath(undefined, 'foo')).toEqual({ found: false });
      expect(resolvePath('string', 'foo')).toEqual({ found: false });
      expect(resolvePath(123, 'foo')).toEqual({ found: false });
      expect(resolvePath({ name: 'test' }, '.')).toEqual({ found: true, value: { name: 'test' } });
      expect(resolvePath({ name: 'test' }, 'this')).toEqual({
        found: true,
        value: { name: 'test' },
      });
    });

    it('handles isFalsy with Handlebars empty array semantics', () => {
      expect(isFalsy([])).toBe(true);
      expect(isFalsy([1])).toBe(false);
      expect(isFalsy(null)).toBe(true);
      expect(isFalsy(undefined)).toBe(true);
      expect(isFalsy(false)).toBe(true);
      expect(isFalsy(0)).toBe(true);
      expect(isFalsy('')).toBe(true);
      expect(isFalsy('hello')).toBe(false);
      expect(isFalsy(true)).toBe(false);
    });

    it('handles literal boolean expressions in #if and #unless blocks', () => {
      expect(renderTemplate('{{#if true}}YES{{else}}NO{{/if}}', {})).toBe('YES');
      expect(renderTemplate('{{#if false}}YES{{else}}NO{{/if}}', {})).toBe('NO');
      expect(renderTemplate('{{#unless true}}YES{{else}}NO{{/unless}}', {})).toBe('NO');
      expect(renderTemplate('{{#unless false}}YES{{else}}NO{{/unless}}', {})).toBe('YES');
    });

    it('handles helper hash parameters and subexpression hash pairs', () => {
      const output = renderTemplate('{{formatDate date format="iso"}}', {
        date: new Date('2026-10-25T12:00:00.000Z'),
      });
      expect(output).toBe('2026-10-25T12:00:00.000Z');

      const subOutput = renderTemplate('{{uppercase (formatDate date format="iso")}}', {
        date: new Date('2026-10-25T12:00:00.000Z'),
      });
      expect(subOutput).toBe('2026-10-25T12:00:00.000Z');
    });

    it('handles data variables and helper params with @root', () => {
      const output = renderTemplate('Root: {{@root.appName}}', { appName: 'NotifyKit' });
      expect(output).toBe('Root: NotifyKit');

      const helperOutput = renderTemplate('{{uppercase @root.name}}', { name: 'alice' });
      expect(helperOutput).toBe('ALICE');
    });

    it('handles resolvePath explicit undefined property value', () => {
      expect(resolvePath({ explicitUndef: undefined }, 'explicitUndef')).toEqual({
        found: false,
      });
    });

    it('handles formatDate with non-format hash and non-array each/with blocks', () => {
      const out = renderTemplate('{{formatDate date customArg="xyz"}}', {
        date: new Date('2026-10-25T10:00:00.000Z'),
      });
      expect(out).toBe('2026-10-25');

      // #if without else when condition is false
      expect(renderTemplate('{{#if false}}hidden{{/if}}', {})).toBe('');

      // #unless without else when condition is true
      expect(renderTemplate('{{#unless true}}hidden{{/unless}}', {})).toBe('');

      // #each with empty array without else block
      expect(renderTemplate('{{#each items}}item{{/each}}', { items: [] })).toBe('');

      // #each with non-array object
      expect(
        renderTemplate('{{#each items}}item{{/each}}', {
          items: 'not-array' as unknown as unknown[],
        }),
      ).toBe('');

      // #with non-object
      expect(
        renderTemplate('{{#with user}}hello{{/with}}', {
          user: 'string-not-object' as unknown as Record<string, unknown>,
        }),
      ).toBe('hello');
    });

    it('handles subexpression conditions in #if and #unless blocks', () => {
      expect(
        renderTemplate('{{#if (uppercase status)}}ACTIVE{{/if}}', {
          status: 'ok',
        }),
      ).toBe('ACTIVE');
      expect(
        renderTemplate('{{#unless (uppercase status)}}INACTIVE{{else}}OK{{/unless}}', {
          status: 'ok',
        }),
      ).toBe('OK');
    });

    it('handles custom block helpers and default loadFromDirectory', async () => {
      const customHbs = createIsolatedHandlebars();
      customHbs.registerHelper(
        'customWrap',
        function (this: unknown, options: { fn: (ctx: unknown) => string }) {
          return `[${options.fn(this)}]`;
        },
      );
      const store = new TemplateStore(customHbs);
      store.register('wrapped', '{{#customWrap}}Hello {{name}}{{/customWrap}}');
      expect(store.render('wrapped', { name: 'World' })).toBe('[Hello World]');

      // Test loadFromDirectory with default extension parameter
      const defaultLoadDir = await mkdtemp(join(tmpdir(), 'notifykit-default-load-'));
      try {
        await writeFile(join(defaultLoadDir, 'default.hbs'), 'Default: {{val}}');
        const count = await store.loadFromDirectory(defaultLoadDir);
        expect(count).toBe(1);
        expect(store.render('default', { val: 'yes' })).toBe('Default: yes');
      } finally {
        await rm(defaultLoadDir, { recursive: true, force: true });
      }
    });
  });
});
