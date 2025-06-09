/**
 * HTTP Utilities
 * HTTP request and response handling utilities
 */

/**
 * Default base URL for WHOOP API
 */
export const DEFAULT_BASE_URL = 'https://api.prod.whoop.com/developer';

/**
 * Build URL with query parameters
 */
export function buildUrl(baseUrl: string, path: string, params?: Record<string, any>): string {
  // Ensure baseUrl doesn't end with slash and path doesn't start with slash
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Construct the full URL
  const fullUrl = `${cleanBaseUrl}/${cleanPath}`;
  const url = new URL(fullUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Create timeout signal
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Combine multiple abort signals
 */
export function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  
  const validSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  
  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  
  return controller.signal;
}

/**
 * Parse pagination token
 */
export function parsePaginationToken(token?: string): Record<string, any> | null {
  if (!token) return null;
  
  try {
    if (isNode()) {
      // Node.js environment - use Buffer
      const bufferGlobal = (globalThis as any).Buffer;
      if (bufferGlobal) {
        return JSON.parse(bufferGlobal.from(token, 'base64').toString('utf-8'));
      }
    }
    
    // Browser environment or fallback
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

/**
 * Create pagination token
 */
export function createPaginationToken(data: Record<string, any>): string {
  const jsonString = JSON.stringify(data);
  
  if (isNode()) {
    // Node.js environment - use Buffer
    const bufferGlobal = (globalThis as any).Buffer;
    if (bufferGlobal) {
      return bufferGlobal.from(jsonString, 'utf-8').toString('base64');
    }
  }
  
  // Browser environment or fallback
  return btoa(jsonString);
}

/**
 * Check if running in Node.js environment
 */
export function isNode(): boolean {
  return typeof globalThis !== 'undefined' &&
         typeof (globalThis as any).process !== 'undefined' && 
         (globalThis as any).process.versions != null && 
         (globalThis as any).process.versions.node != null;
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined';
}

/**
 * Get user agent string
 */
export function getUserAgent(): string {
  const version = '1.0.0'; // This should be dynamically imported from package.json
  
  if (isNode()) {
    const processVersion = (globalThis as any).process?.version || 'unknown';
    return `whoop-sdk-js/${version} (Node.js ${processVersion})`;
  }
  
  if (isBrowser()) {
    return `whoop-sdk-js/${version} (Browser)`;
  }
  
  return `whoop-sdk-js/${version}`;
} 