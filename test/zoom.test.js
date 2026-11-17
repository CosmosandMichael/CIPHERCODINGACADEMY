const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createZoomMeeting, deleteZoomMeeting, isZoomConfigured } = require("../src/zoom");

test("creates and deletes a Zoom meeting using the configured host", async () => {
 const previousEnv = {
  ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID,
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
  ZOOM_HOST_USER_ID: process.env.ZOOM_HOST_USER_ID
 };
 const originalFetch = global.fetch;
 const requests = [];
 process.env.ZOOM_ACCOUNT_ID = "account";
 process.env.ZOOM_CLIENT_ID = "client";
 process.env.ZOOM_CLIENT_SECRET = "secret";
 process.env.ZOOM_HOST_USER_ID = "teacher@example.com";
 global.fetch = async (url, options) => {
  requests.push({ url: String(url), options });
  if (String(url).startsWith("https://zoom.us/oauth/token")) {
   return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), { status: 200 });
  }
  if (options.method === "POST") {
   return new Response(JSON.stringify({
    id: 123,
    join_url: "https://zoom.us/j/123",
    start_url: "https://zoom.us/s/123"
   }), { status: 201 });
  }
  return new Response(null, { status: 204 });
 };
 try {
  assert.equal(isZoomConfigured(), true);
  const meeting = await createZoomMeeting({
   title: "Test lesson",
   startsAt: "2030-01-01T10:00:00.000Z",
   duration: 45
  });
  assert.equal(meeting.id, 123);
  const createRequest = requests.find(request => request.options.method === "POST");
  assert.ok(createRequest.url.includes("/users/teacher%40example.com/meetings"));
  assert.equal(createRequest.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(createRequest.options.body), {
   topic: "Test lesson",
   type: 2,
   start_time: "2030-01-01T10:00:00.000Z",
   duration: 45,
   settings: {
    join_before_host: false,
    waiting_room: true,
    host_video: false,
    participant_video: false,
    mute_upon_entry: true,
    auto_recording: "none"
   }
  });
  await deleteZoomMeeting("123");
  assert.ok(requests.some(request => request.url.endsWith("/meetings/123") && request.options.method === "DELETE"));
 } finally {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(previousEnv)) {
   if (value === undefined) delete process.env[name];
   else process.env[name] = value;
  }
 }
});
