/**
 * Domain Error Classes
 *
 * Each maps to a specific HTTP status code and RFC 9457 error type.
 * These are thrown from the Domain and Application layers and caught
 * by the Presentation layer's errorHandler middleware.
 */

const BASE_URI = 'https://api.zorvyn.com/errors';

export class DomainError extends Error {
  constructor(message, statusCode, type) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
  }

  /**
   * Converts to RFC 9457 Problem Details JSON.
   * @param {string} [instance] - The request path
   * @returns {object}
   */
  toProblemDetails(instance) {
    return {
      type: this.type,
      title: this.name.replace(/Error$/, ' Error').replace(/([A-Z])/g, ' $1').trim(),
      status: this.statusCode,
      detail: this.message,
      ...(instance && { instance }),
    };
  }
}

/**
 * 400 Bad Request — malformed input, failed validation
 */
export class ValidationError extends DomainError {
  constructor(message = 'Validation failed.') {
    super(message, 400, `${BASE_URI}/validation-error`);
  }
}

/**
 * 401 Unauthorized — missing or invalid authentication
 */
export class AuthenticationError extends DomainError {
  constructor(message = 'Authentication required.') {
    super(message, 401, `${BASE_URI}/authentication-error`);
  }
}

/**
 * 403 Forbidden — authenticated but lacking permission (PoLP enforcement)
 */
export class AuthorizationError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, `${BASE_URI}/authorization-error`);
  }
}

/**
 * 404 Not Found — resource does not exist
 */
export class NotFoundError extends DomainError {
  constructor(message = 'The requested resource was not found.') {
    super(message, 404, `${BASE_URI}/not-found`);
  }
}

/**
 * 409 Conflict — duplicate resource (e.g., email already registered)
 */
export class ConflictError extends DomainError {
  constructor(message = 'A resource with the given identifier already exists.') {
    super(message, 409, `${BASE_URI}/conflict`);
  }
}
