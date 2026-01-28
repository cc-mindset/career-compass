import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger.js';

let io: Server | null = null;
let isWebSocketEnabled = false;

/**
 * Initialize WebSocket server (call once in server.ts)
 * Returns true if successful, false if failed (non-blocking)
 */
export function initializeWebSocket(httpServer: HttpServer): boolean {
  try {
    io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      logger.info(`WebSocket connected: ${socket.id}`);

      socket.on('subscribe', (jobId: string) => {
        socket.join(`job:${jobId}`);
        logger.info(`Socket ${socket.id} subscribed to job:${jobId}`);
      });

      socket.on('disconnect', () => {
        logger.info(`WebSocket disconnected: ${socket.id}`);
      });
    });

    isWebSocketEnabled = true;
    logger.info('-> WebSocket server initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize WebSocket:', error);
    logger.warn('⚠️  Continuing without WebSocket - polling will be used');
    isWebSocketEnabled = false;
    return false;
  }
}

/**
 * Check if WebSocket is available
 */
export function isWebSocketAvailable(): boolean {
  return isWebSocketEnabled && io !== null;
}

/**
 * Get WebSocket server instance (safe)
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit to job (SAFE - no-op if WebSocket unavailable)
 */
export function emitToJob(jobId: string, event: string, data: any) {
  if (!isWebSocketAvailable()) {
    // Silently skip if WebSocket not available
    return;
  }
  
  try {
    io!.to(`job:${jobId}`).emit(event, data);
    logger.info(`Emitted ${event} to job:${jobId}`);
  } catch (error) {
    logger.error(`Failed to emit ${event} to job:${jobId}:`, error);
  }
}

/**
 * Convenience function for job progress (SAFE)
 */
export function emitJobProgress(jobId: string, progress: {
  stage: string;
  progress?: number;
  insights?: any;
  error?: string;
  
}) {
  emitToJob(jobId, 'progress', progress);
}