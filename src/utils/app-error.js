class AppError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'AppError';
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'INTERNAL_SERVER_ERROR';
    this.details = options.details;
  }
}

module.exports = AppError;
