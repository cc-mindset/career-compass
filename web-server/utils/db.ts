export const getDbCacheKeyForLlmResponse = (prefix: string, ...vars: string[]): string => {
    return `${prefix}:${vars.join('__')}`;
}