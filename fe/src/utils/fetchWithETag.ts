/**
 * ETag-aware fetch wrapper for TanStack Query.
 *
 * Handles conditional requests using If-None-Match header and
 * returns cached data on 304 Not Modified responses.
 *
 * Usage in queryFn:
 *   queryFn: async () => {
 *     const cached = queryClient.getQueryData(queryKey);
 *     return fetchWithETag('/api/endpoint', cached);
 *   }
 */

/** Data type with embedded ETag for cache validation */
export type WithETag<T> = T & { _etag?: string };

/**
 * Fetch with ETag support for conditional requests.
 *
 * @param url - The URL to fetch
 * @param cachedData - Previously cached data with _etag field
 * @param options - Additional fetch options
 * @returns The response data with _etag embedded, or cached data on 304
 */
export async function fetchWithETag<T>(
  url: string,
  cachedData: WithETag<T> | undefined,
  options?: RequestInit,
): Promise<WithETag<T>> {
  const headers = new Headers(options?.headers);

  // Send cached ETag if available
  if (cachedData?._etag) {
    headers.set("If-None-Match", cachedData._etag);
  }

  const response = await fetch(url, { ...options, headers });

  // 304 Not Modified - return cached data as-is
  if (response.status === 304) {
    if (!cachedData) {
      throw new Error("Received 304 but no cached data available");
    }
    return cachedData;
  }

  // Error handling
  if (response.status < 200 || response.status > 299) {
    throw new Error("Request failed", { cause: await response.text() });
  }

  // Parse new data and attach ETag
  const data = (await response.json()) as T;
  const etag = response.headers.get("etag");

  if (etag) {
    return Object.assign(data as object, { _etag: etag }) as WithETag<T>;
  }
  return data as WithETag<T>;
}
