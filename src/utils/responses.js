function sendSuccess(res, options = {}) {
  const statusCode = options.statusCode || 200;

  return res.status(statusCode).json({
    success: true,
    data: options.data || {},
    message: options.message || 'Request completed successfully.'
  });
}

function sendError(res, error) {
  return res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message
    }
  });
}

module.exports = {
  sendError,
  sendSuccess
};
