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

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type FetchWithETagOptions = RequestInit & {
  params?: QueryParams;
};

function buildUrl(url: string, params?: QueryParams): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const built = new URL(url, window.location.origin);
  const search = new URLSearchParams(built.search);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }

  built.search = search.toString();
  return built.toString();
}

/**
 * Fetch with ETag support for conditional requests.
 *
 * @param url - The URL to fetch
 * @param cachedData - Previously cached data with _etag field
 * @param options - Additional fetch options (including query params)
 * @returns The response data with _etag embedded, or cached data on 304
 */
export async function fetchWithETag<T>(
  url: string,
  cachedData: WithETag<T> | undefined,
  options?: FetchWithETagOptions,
): Promise<WithETag<T>> {
  const headers = new Headers(options?.headers);

  // Send cached ETag if available
  if (cachedData?._etag) {
    headers.set("If-None-Match", cachedData._etag);
  }

  const { params, ...fetchOptions } = options ?? {};
  const requestUrl = buildUrl(url, params);
  const response = await fetch(requestUrl, { ...fetchOptions, headers });

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
