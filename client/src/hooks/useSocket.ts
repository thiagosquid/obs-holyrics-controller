import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { PresentationState, CommandType } from '../types';

interface UseSocketOptions {
  token?: string;
  adminPassword?: string;
}

export function useSocket({ token, adminPassword }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [state, setState] = useState<PresentationState | null>(null);
  const [commandResult, setCommandResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    const auth: Record<string, string> = {};
    if (token) auth.token = token;
    if (adminPassword) auth.adminPassword = adminPassword;

    const socket = io({ auth });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError('');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setConnected(false);
    });

    socket.on('state', (newState: PresentationState) => {
      setState(newState);
    });

    socket.on('commandResult', (result: { success: boolean; error?: string }) => {
      setCommandResult(result);
      setTimeout(() => setCommandResult(null), 2000);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, adminPassword]);

  const sendCommand = useCallback((type: CommandType, params?: Record<string, unknown>) => {
    socketRef.current?.emit('command', { type, params });
  }, []);

  return { connected, error, state, sendCommand, commandResult };
}
