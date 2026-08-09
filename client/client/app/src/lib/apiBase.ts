/** API origin for web-server. Empty string disables live market calls (fixtures/demo). */
export const getApiBaseUrl = (): string => {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== 'string') return '';
  return raw.replace(/\/$/, '');
};

export const isApiConfigured = (): boolean => getApiBaseUrl().length > 0;
