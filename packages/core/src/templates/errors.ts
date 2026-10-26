import { NotifyKitError } from '../errors/notifykit-error';

/**
 * Thrown when a template identifier is requested but has not been registered in TemplateStore.
 */
export class MissingTemplateError extends NotifyKitError {
  readonly templateId: string;

  constructor(templateId: string) {
    super({
      code: 'E_MISSING_TEMPLATE',
      message: `Template "${templateId}" is not registered`,
      hint: `Register the template before use using notifier.registerTemplate("${templateId}", source) or store.register("${templateId}", source)`,
    });
    this.name = 'MissingTemplateError';
    this.templateId = templateId;
  }
}

/**
 * Thrown when a template references a variable that is missing (undefined) in the data payload.
 */
export class MissingVariableError extends NotifyKitError {
  readonly variableName: string;
  readonly templateId?: string;

  constructor(variableName: string, templateId?: string) {
    const contextMsg = templateId ? `in template "${templateId}"` : 'in template';
    super({
      code: 'E_MISSING_VARIABLE',
      message: `Required template variable "${variableName}" is missing ${contextMsg}`,
      hint: `Provide "${variableName}" in the notification data payload: { data: { ${variableName}: ... } }`,
    });
    this.name = 'MissingVariableError';
    this.variableName = variableName;
    this.templateId = templateId;
  }
}

/**
 * Thrown when template source contains invalid Handlebars syntax.
 */
export class TemplateSyntaxError extends NotifyKitError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'E_TEMPLATE_SYNTAX',
      message: `Malformed template syntax: ${message}`,
      hint: 'Check template syntax for unclosed tags, invalid helper invocations, or mismatched block helpers',
      cause,
    });
    this.name = 'TemplateSyntaxError';
  }
}
