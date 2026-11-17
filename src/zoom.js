let cachedToken = null;
let tokenExpiresAt = 0;

class ZoomApiError extends Error {
 constructor(message, status = 502) {
  super(message);
  this.name = "ZoomApiError";
  this.status = status;
 }
}

function isZoomConfigured() {
 return ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_HOST_USER_ID"]
  .every(name => Boolean(process.env[name]));
}

async function zoomRequest(url, options) {
 let response;
 try {
  response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
 } catch {
  throw new ZoomApiError("Could not reach Zoom. Check the server connection and try again.", 502);
 }
 const data = await response.json().catch(() => ({}));
 if (!response.ok) {
  const message = typeof data.message === "string" ? data.message : "Zoom rejected the request.";
  throw new ZoomApiError(message, response.status >= 400 && response.status < 500 ? 502 : 503);
 }
 return data;
}

async function accessToken() {
 if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
 const credentials = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
 const query = new URLSearchParams({
  grant_type: "account_credentials",
  account_id: process.env.ZOOM_ACCOUNT_ID
 });
 const data = await zoomRequest(`https://zoom.us/oauth/token?${query}`, {
  method: "POST",
  headers: { Authorization: `Basic ${credentials}` }
 });
 if (typeof data.access_token !== "string" || !Number.isFinite(data.expires_in)) {
  throw new ZoomApiError("Zoom returned an invalid access token response.", 502);
 }
 cachedToken = data.access_token;
 tokenExpiresAt = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
 return cachedToken;
}

async function createZoomMeeting({ title, startsAt, duration }) {
 const token = await accessToken();
 return zoomRequest(`https://api.zoom.us/v2/users/${encodeURIComponent(process.env.ZOOM_HOST_USER_ID)}/meetings`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
   topic: title,
   type: 2,
   start_time: startsAt,
   duration,
   settings: {
    join_before_host: false,
    waiting_room: true,
    host_video: false,
    participant_video: false,
    mute_upon_entry: true,
    auto_recording: "none"
   }
  })
 });
}

async function deleteZoomMeeting(meetingId) {
 const token = await accessToken();
 await zoomRequest(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` }
 });
}

module.exports = { ZoomApiError, isZoomConfigured, createZoomMeeting, deleteZoomMeeting };
