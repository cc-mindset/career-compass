import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from './apiBase';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  const url = getApiBaseUrl();
  if (!url) return null;

  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true,
  });

  return socket;
};

export const waitForSocketConnection = async (timeoutMs = 5000): Promise<boolean> => {
  const current = getSocket();
  if (!current) return false;
  if (current.connected) return true;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    current.once('connect', () => {
      window.clearTimeout(timer);
      resolve(true);
    });
    if (!current.connected) current.connect();
  });
};
