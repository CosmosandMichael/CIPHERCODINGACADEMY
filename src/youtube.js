function youtubeVideoId(value) {
 if (typeof value !== "string") return null;
 const input = value.trim();
 if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
 let url;
 try { url = new URL(input); } catch { return null; }
 const host = url.hostname.toLowerCase();
 let id = null;
 if (["youtu.be", "www.youtu.be"].includes(host)) {
  id = url.pathname.split("/").filter(Boolean)[0];
 } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
  if (url.pathname === "/watch") id = url.searchParams.get("v");
  else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || null;
 }
 return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

module.exports = { youtubeVideoId };
