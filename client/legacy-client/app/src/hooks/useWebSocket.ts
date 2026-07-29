 ///<reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../providers/socket/socket';

export function useWebSocket() {
  //null until mounted
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ensure a socket instance is available synchronously for the first render.
  if (!socketRef.current) {
    socketRef.current = getSocket();
  }

  useEffect(() => {
    // Build url from env
    const url = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    console.log(`[useWebSocket] Hook mounted, initializing socket connection to: ${url}`);

    // Use a global singleton socket to avoid repeated connects/disconnects during React Strict Mode 
    const socket = getSocket();
    socketRef.current = socket;

    // Check if already connected
    if (socket.connected) {
      console.log(`[useWebSocket] Socket already connected: ${socket.id}`);
      setIsConnected(true);
    }

    const onConnect = () => {
      console.log(`[useWebSocket] ✓ WebSocket connected with ID: ${socket.id}`);
      setIsConnected(true);
    };
    const onDisconnect = (reason?: string) => {
      console.log(`[useWebSocket] ✗ WebSocket disconnected: ${reason || 'unknown reason'}`);
      setIsConnected(false);
    };
    const onError = (err: any) => {
      console.error(`[useWebSocket] Connection error:`, err && err.message ? err.message : err);
      setIsConnected(false);
    };

    // Register listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('error', onError);

    // Force connection attempt if not connected
    if (!socket.connected) {
      console.log(`[useWebSocket] Forcing connection attempt...`);
      socket.connect();
    }

    return () => {
      // Clean up listeners on unmount. Do NOT disconnect the singleton socket
      // we want the global socket to remain active for other components.
      if (socketRef.current) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onError);
        socket.off('error', onError);
      }
    };
  }, []);

  return { socket: socketRef.current, isConnected };
}