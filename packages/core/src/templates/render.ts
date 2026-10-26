import Handlebars from 'handlebars';
import { MissingVariableError, TemplateSyntaxError } from './errors';
import { registerDefaultHelpers } from './helpers';

/**
 * Creates and configures an isolated Handlebars environment with default helpers.
 */
export function createIsolatedHandlebars(): typeof Handlebars {
  const hbs = Handlebars.create();
  registerDefaultHelpers(hbs);
  return hbs;
}

const defaultHandlebars = createIsolatedHandlebars();

/**
 * Resolves a dot-notated variable path against a data context object.
 * Returns found: true with value if the path resolves to any defined value (including null, false, 0, "").
 * Returns found: false if any segment or the final value is missing or undefined.
 */
export function resolvePath(data: unknown, pathStr: string): { found: boolean; value?: unknown } {
  if (pathStr === '.' || pathStr === 'this') {
    return { found: data !== undefined, value: data };
  }

  if (data === null || data === undefined || typeof data !== 'object') {
    return { found: false };
  }

  const segments = pathStr.split('.');
  let current: unknown = data;

  for (const segment of segments) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object' ||
      !(segment in (current as Record<string, unknown>))
    ) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) {
      return { found: false };
    }
  }

  return { found: true, value: current };
}

/**
 * Determines whether a value evaluates to falsy under Handlebars conditionals.
 * Empty arrays are falsy in Handlebars.
 */
export function isFalsy(val: unknown): boolean {
  if (!val) {
    return true;
  }
  if (Array.isArray(val) && val.length === 0) {
    return true;
  }
  return false;
}

/**
 * Parses a template source string into an AST, wrapping any syntax errors in TemplateSyntaxError.
 */
export function parseTemplate(
  source: string,
  hbsInstance: typeof Handlebars = defaultHandlebars,
): hbs.AST.Program {
  try {
    return hbsInstance.parse(source);
  } catch (err) {
    throw new TemplateSyntaxError(err instanceof Error ? err.message : String(err), err);
  }
}

/**
 * Validates that all required variables in active output branches exist in the data context.
 * Implements Option B:
 * - Output interpolations (e.g. {{name}}, {{user.address.city}}) throw MissingVariableError if undefined.
 * - Conditions in #if and #unless evaluate as falsy if absent and do NOT throw.
 * - Explicit values (false, null, 0, "") are preserved as valid defined values.
 */
export function validateTemplateVariables(
  ast: hbs.AST.Program,
  data: Record<string, unknown>,
  hbsInstance: typeof Handlebars = defaultHandlebars,
  templateId?: string,
): void {
  function checkExpression(expr: hbs.AST.Expression, currentData: Record<string, unknown>): void {
    if (expr.type === 'PathExpression') {
      const pathExpr = expr as hbs.AST.PathExpression;
      if (!pathExpr.data) {
        const res = resolvePath(currentData, pathExpr.original);
        if (!res.found) {
          throw new MissingVariableError(pathExpr.original, templateId);
        }
      }
    } else if (expr.type === 'SubExpression') {
      const sub = expr as hbs.AST.SubExpression;
      if (sub.params) {
        for (const p of sub.params) {
          checkExpression(p, currentData);
        }
      }
      if (sub.hash?.pairs) {
        for (const pair of sub.hash.pairs) {
          checkExpression(pair.value, currentData);
        }
      }
    }
  }

  function walkStatements(
    statements: hbs.AST.Statement[],
    currentData: Record<string, unknown>,
  ): void {
    for (const stmt of statements) {
      if (stmt.type === 'MustacheStatement') {
        const mustache = stmt as hbs.AST.MustacheStatement;
        if (mustache.path.type === 'PathExpression') {
          const pathExpr = mustache.path as hbs.AST.PathExpression;
          if (pathExpr.data) {
            continue;
          }

          if (pathExpr.original in hbsInstance.helpers) {
            // Helper invocation: validate its arguments and hash pairs
            if (mustache.params) {
              for (const param of mustache.params) {
                checkExpression(param, currentData);
              }
            }
            if (mustache.hash?.pairs) {
              for (const pair of mustache.hash.pairs) {
                checkExpression(pair.value, currentData);
              }
            }
          } else {
            // Standard variable interpolation
            const res = resolvePath(currentData, pathExpr.original);
            if (!res.found) {
              throw new MissingVariableError(pathExpr.original, templateId);
            }
          }
        }
      } else if (stmt.type === 'BlockStatement') {
        const block = stmt as hbs.AST.BlockStatement;
        const helperName = block.path.original;

        if (helperName === 'if') {
          const conditionParam = block.params[0];
          let conditionTruthy = false;

          if (conditionParam && conditionParam.type === 'PathExpression') {
            const pathExpr = conditionParam as hbs.AST.PathExpression;
            const res = resolvePath(currentData, pathExpr.original);
            // Option B: absent conditional property evaluates as falsy without error
            const conditionValue = res.found ? res.value : undefined;
            conditionTruthy = !isFalsy(conditionValue);
          } else if (conditionParam && conditionParam.type === 'BooleanLiteral') {
            conditionTruthy = (conditionParam as hbs.AST.BooleanLiteral).value;
          } else if (conditionParam) {
            // For other expression types, evaluate conservatively
            checkExpression(conditionParam, currentData);
            conditionTruthy = true;
          }

          if (conditionTruthy) {
            if (block.program?.body) {
              walkStatements(block.program.body, currentData);
            }
          } else if (block.inverse?.body) {
            walkStatements(block.inverse.body, currentData);
          }
        } else if (helperName === 'unless') {
          const conditionParam = block.params[0];
          let conditionTruthy = false;

          if (conditionParam && conditionParam.type === 'PathExpression') {
            const pathExpr = conditionParam as hbs.AST.PathExpression;
            const res = resolvePath(currentData, pathExpr.original);
            const conditionValue = res.found ? res.value : undefined;
            conditionTruthy = !isFalsy(conditionValue);
          } else if (conditionParam && conditionParam.type === 'BooleanLiteral') {
            conditionTruthy = (conditionParam as hbs.AST.BooleanLiteral).value;
          } else if (conditionParam) {
            checkExpression(conditionParam, currentData);
            conditionTruthy = true;
          }

          // Unless takes program when falsy, inverse when truthy
          if (!conditionTruthy) {
            if (block.program?.body) {
              walkStatements(block.program.body, currentData);
            }
          } else if (block.inverse?.body) {
            walkStatements(block.inverse.body, currentData);
          }
        } else if (helperName === 'each') {
          const collectionParam = block.params[0];
          if (collectionParam && collectionParam.type === 'PathExpression') {
            const pathExpr = collectionParam as hbs.AST.PathExpression;
            const res = resolvePath(currentData, pathExpr.original);
            if (!res.found) {
              throw new MissingVariableError(pathExpr.original, templateId);
            }
            if (Array.isArray(res.value)) {
              if (res.value.length === 0 && block.inverse?.body) {
                walkStatements(block.inverse.body, currentData);
              } else if (res.value.length > 0 && block.program?.body) {
                for (const item of res.value) {
                  const itemContext =
                    item !== null && typeof item === 'object'
                      ? { ...currentData, ...(item as Record<string, unknown>), this: item }
                      : { ...currentData, this: item };
                  walkStatements(block.program.body, itemContext);
                }
              }
            }
          }
        } else if (helperName === 'with') {
          const contextParam = block.params[0];
          if (contextParam && contextParam.type === 'PathExpression') {
            const pathExpr = contextParam as hbs.AST.PathExpression;
            const res = resolvePath(currentData, pathExpr.original);
            if (!res.found) {
              throw new MissingVariableError(pathExpr.original, templateId);
            }
            if (res.value !== null && typeof res.value === 'object' && block.program?.body) {
              walkStatements(block.program.body, {
                ...currentData,
                ...(res.value as Record<string, unknown>),
              });
            }
          }
        } else if (block.program?.body) {
          walkStatements(block.program.body, currentData);
        }
      }
    }
  }

  walkStatements(ast.body, data);
}

/**
 * Compiles and renders a raw Handlebars template string with user data.
 * Validates that all required template variables are present in the data context.
 *
 * @param source Raw Handlebars template string
 * @param data Data context object for interpolation
 * @param templateId Optional template identifier for error context
 * @returns Rendered output string
 * @throws {MissingVariableError} If an output variable referenced in the template is undefined
 * @throws {TemplateSyntaxError} If template syntax is malformed
 */
export function renderTemplate(
  source: string,
  data: Record<string, unknown>,
  templateId?: string,
): string {
  const ast = parseTemplate(source, defaultHandlebars);
  validateTemplateVariables(ast, data, defaultHandlebars, templateId);

  const delegate = defaultHandlebars.compile(source);
  return delegate(data);
}
