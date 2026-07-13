import type {
  BlotatoAnalyticsResponse,
  BlotatoCreatePostRequest,
  BlotatoCreatePostResponse,
  BlotatoPostStatusResponse,
  BlotatoSchedulesResponse,
} from "./types";

const BASE_URL = process.env.BLOTATO_BASE_URL ?? "https://backend.blotato.com/v2";

/**
 * Thin fetch wrapper around Blotato's REST API. This is the ONLY file that
 * should call blotato.com directly — everything else goes through
 * services/post.service.ts. Auth is the `blotato-api-key` header, not Bearer.
 */
export class BlotatoClient {
  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "blotato-api-key": this.apiKey,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Blotato API error ${res.status} on ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  createPost(body: BlotatoCreatePostRequest): Promise<BlotatoCreatePostResponse> {
    return this.request<BlotatoCreatePostResponse>("/posts", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  getPostStatus(postSubmissionId: string): Promise<BlotatoPostStatusResponse> {
    return this.request<BlotatoPostStatusResponse>(`/posts/${postSubmissionId}`);
  }

  listSchedules(params?: { limit?: number; cursor?: string }): Promise<BlotatoSchedulesResponse> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.cursor) qs.set("cursor", params.cursor);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request<BlotatoSchedulesResponse>(`/schedules${suffix}`);
  }

  getAnalytics(params: {
    since: string;
    until: string;
    platform?: string;
    sortBy?: string;
    limit?: number;
  }): Promise<BlotatoAnalyticsResponse> {
    const qs = new URLSearchParams({ since: params.since, until: params.until });
    if (params.platform) qs.set("platform", params.platform);
    if (params.sortBy) qs.set("sortBy", params.sortBy);
    if (params.limit) qs.set("limit", String(params.limit));
    return this.request<BlotatoAnalyticsResponse>(`/analytics?${qs.toString()}`);
  }
}

/** Coerces Blotato's string-typed metric counts to numbers — every call site must go through this, never parse ad hoc. */
export function coerceMetricCount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
