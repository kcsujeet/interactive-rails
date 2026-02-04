/**
 * Structured logging utility
 * Outputs JSON logs for easy parsing by log aggregators
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
	requestId?: string;
	userId?: string;
	[key: string]: unknown;
}

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	requestId?: string;
	userId?: string;
	error?: {
		message: string;
		stack?: string;
		code?: string;
	};
	[key: string]: unknown;
}

function formatLog(
	level: LogLevel,
	message: string,
	meta?: LogMeta,
	error?: Error,
): string {
	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		...meta,
	};

	if (error) {
		entry.error = {
			message: error.message,
			stack: error.stack,
			code: (error as { code?: string }).code,
		};
	}

	return JSON.stringify(entry);
}

export const logger = {
	debug(message: string, meta?: LogMeta): void {
		if (process.env.LOG_LEVEL === 'debug') {
			console.debug(formatLog('debug', message, meta));
		}
	},

	info(message: string, meta?: LogMeta): void {
		console.info(formatLog('info', message, meta));
	},

	warn(message: string, meta?: LogMeta): void {
		console.warn(formatLog('warn', message, meta));
	},

	error(message: string, error?: Error, meta?: LogMeta): void {
		console.error(formatLog('error', message, meta, error));
	},
};

/**
 * Creates a child logger with preset metadata
 */
export function createLogger(defaultMeta: LogMeta) {
	return {
		debug: (message: string, meta?: LogMeta) =>
			logger.debug(message, { ...defaultMeta, ...meta }),
		info: (message: string, meta?: LogMeta) =>
			logger.info(message, { ...defaultMeta, ...meta }),
		warn: (message: string, meta?: LogMeta) =>
			logger.warn(message, { ...defaultMeta, ...meta }),
		error: (message: string, error?: Error, meta?: LogMeta) =>
			logger.error(message, error, { ...defaultMeta, ...meta }),
	};
}
