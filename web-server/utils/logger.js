/**
 * Simple structured logger with color-coded output
 * Makes debugging easy with clear visual hierarchy
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const logLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.minLevel = logLevels[this.level] || logLevels.INFO;
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with color
   */
  formatMessage(level, message, ...args) {
    const timestamp = this.getTimestamp();
    const colorMap = {
      DEBUG: colors.dim,
      INFO: colors.cyan,
      WARN: colors.yellow,
      ERROR: colors.red,
    };

    const color = colorMap[level] || colors.white;
    const reset = colors.reset;

    return `${colors.dim}[${timestamp}]${reset} ${color}${level}${reset} ${message}`;
  }

  /**
   * Check if level should be logged
   */
  shouldLog(level) {
    return logLevels[level] >= this.minLevel;
  }

  /**
   * Debug level logging
   */
  debug(message, ...args) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  /**
   * Info level logging
   */
  info(message, ...args) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message), ...args);
    }
  }

  /**
   * Warning level logging
   */
  warn(message, ...args) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  /**
   * Error level logging
   */
  error(message, ...args) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  /**
   * Log object with pretty formatting
   */
  object(obj, label = 'Object') {
    if (this.shouldLog('DEBUG')) {
      console.log(`${colors.cyan}${label}:${colors.reset}`);
      console.dir(obj, { depth: null, colors: true });
    }
  }
}

// Export singleton instance
export const logger = new Logger();
