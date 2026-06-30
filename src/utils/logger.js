function write(level, args) {
  const method = level === 'error' ? console.error : console.log;
  method(`[${level.toUpperCase()}]`, ...args);
}

const logger = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  stream: {
    write: (message) => {
      const trimmedMessage = message.trim();

      if (trimmedMessage) {
        write('info', [trimmedMessage]);
      }
    }
  }
};

module.exports = logger;
