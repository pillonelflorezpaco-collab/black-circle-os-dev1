/** DTOs for Blotato's REST API (https://backend.blotato.com/v2) — response shapes only, not our own domain types. */

export interface BlotatoCreatePostRequest {
  post: {
    accountId: string;
    content: {
      text: string;
      mediaUrls: string[];
      platform: string;
    };
    target: {
      targetType: string;
      mediaType?: string;
      pageId?: string;
      boardId?: string;
      title?: string;
      privacyStatus?: string;
      shouldNotifySubscribers?: boolean;
      trial?: { graduationStrategy: "MANUAL" | "AUTO" };
    };
  };
  scheduledTime: string; // ISO 8601
}

export interface BlotatoCreatePostResponse {
  postSubmissionId: string;
}

export interface BlotatoPostStatusResponse {
  status: "in-progress" | "published" | "failed";
  publicUrl?: string;
  errorMessage?: string;
}

export interface BlotatoScheduleItem {
  id: string;
  scheduledAt: string;
  draft: {
    content: {
      platform: string;
      text: string;
    };
  };
}

export interface BlotatoSchedulesResponse {
  items: BlotatoScheduleItem[];
  cursor: string | null;
}

/** Raw analytics item — Blotato returns metric counts as STRINGS, coerce at the service boundary. */
export interface BlotatoAnalyticsItem {
  id: string;
  postUrl: string;
  content: string;
  createdAt: string;
  latestMetrics: {
    metrics: {
      viewsCount: string;
      likesCount: string;
      commentsCount: string;
      savesCount: string;
      sharesCount: string;
      reachCount: string;
    };
  };
}

export interface BlotatoAnalyticsResponse {
  items: BlotatoAnalyticsItem[];
}
