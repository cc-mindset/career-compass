import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket() {
  if (socket) {
    // If socket exists but not connected, try to connect
    if (!socket.connected) socket.connect();
    return socket;
  }

  const url = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  console.log(`[Socket] Initializing socket connection to: ${url}`);

  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true, // Ensure auto-connect is enabled
  });

  socket.on('connect', () => {
    console.log(`[Socket] ✓ Connected with ID: ${socket?.id}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] ✗ Disconnected: ${reason}`);
  });

  socket.on('connect_error', (error) => {
    console.error(`[Socket] Connection error:`, error.message);
  });

  // Ensure connection is attempted immediately
  if (!socket.connected) socket.connect();

  return socket;
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export async function waitForSocketConnection(timeout = 5000): Promise<boolean> {
  if (!socket) {
    socket = getSocket();
  }

  if (socket.connected) {
    return true;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn('[Socket] Connection timeout');
      resolve(false);
    }, timeout);

    socket!.on('connect', () => {
      clearTimeout(timeoutId);
      resolve(true);
    });

    // If already connected, resolve immediately
    if (socket!.connected) {
      clearTimeout(timeoutId);
      resolve(true);
    }
  });
}
