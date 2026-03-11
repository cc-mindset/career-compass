import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger.js';

let io: Server | null = null;
let isWebSocketEnabled = false;

/**
 * Initialize WebSocket server (call once in server/index.ts)
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
      logger.info(`✓ WebSocket connected: ${socket.id}`);
      console.log(`✓ WebSocket connected: ${socket.id}`);

      socket.on('subscribe', (jobId: string) => {
        if (!jobId || typeof jobId !== 'string') {
          logger.warn(`Invalid jobId received for subscription: ${jobId}`);
          console.warn(`Invalid jobId received for subscription: ${jobId}`);
          return;
        }
        socket.join(`job:${jobId}`);
        logger.info(`Socket ${socket.id} subscribed to job:${jobId}`);
        console.log(`✓ Socket ${socket.id} subscribed to job:${jobId}`);
      });

      socket.on('disconnect', (reason) => {
        logger.info(`WebSocket disconnected: ${socket.id}, reason: ${reason}`);
        console.log(`✗ WebSocket disconnected: ${socket.id}, reason: ${reason}`);
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
    logger.warn(`WebSocket not available, skipping emit ${event} to job:${jobId}`);
    console.warn(`⚠️  WebSocket not available, skipping emit ${event} to job:${jobId}`);
    return;
  }
  
  if (!jobId || typeof jobId !== 'string') {
    logger.warn(`Invalid jobId for emit: ${jobId}`);
    console.warn(`⚠️  Invalid jobId for emit: ${jobId}`);
    return;
  }
  
  try {
    const room = `job:${jobId}`;
    const socketsInRoom = io!.sockets.adapter.rooms.get(room);
    const count = socketsInRoom ? socketsInRoom.size : 0;
    
    io!.to(room).emit(event, data);
    logger.info(`✓ Emitted ${event} to job:${jobId} (${count} socket(s) in room)`);
    console.log(`✓ Emitted ${event} to job:${jobId} (${count} socket(s) listening)`);
  } catch (error) {
    logger.error(`Failed to emit ${event} to job:${jobId}:`, error);
    console.error(`✗ Failed to emit ${event} to job:${jobId}:`, error);
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