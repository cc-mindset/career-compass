export type ApiStatus = 'idle' | 'in-progress' | 'success' | 'error';

export interface ApiState<T> {
  status: ApiStatus;
  data?: T;
  error?: string;
}

export const createInitialApiState = <T>(): ApiState<T> => ({
  status: 'in-progress',
  data: undefined,
  error: undefined,
});

