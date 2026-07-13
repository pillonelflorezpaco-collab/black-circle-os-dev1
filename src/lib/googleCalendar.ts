import { google } from "googleapis";

/**
 * Single shared "Black Circle" Google Calendar — every team member's
 * deadlines/review reminders land in the same calendar (see decision:
 * shared calendar, not one per employee). Auth is a service account
 * (server-to-server, no per-user OAuth flow) — share the target calendar
 * with the service account's email and set GOOGLE_CALENDAR_ID.
 *
 * Required env vars:
 *   GOOGLE_CALENDAR_ID                    — the shared calendar's id
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL           — service account client email
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY     — service account private key (PEM, \n-escaped)
 */
function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not configured.");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return google.calendar({ version: "v3", auth });
}

export async function createCalendarEvent(params: {
  summary: string;
  description?: string;
  startTime: Date;
  durationMinutes?: number;
}): Promise<{ id: string; htmlLink: string | null }> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    throw new Error("GOOGLE_CALENDAR_ID not configured.");
  }

  const calendar = getCalendarClient();
  const end = new Date(params.startTime.getTime() + (params.durationMinutes ?? 30) * 60_000);

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: { useDefault: true },
    },
  });

  return { id: res.data.id!, htmlLink: res.data.htmlLink ?? null };
}
