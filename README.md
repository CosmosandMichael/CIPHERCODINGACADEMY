# CIPHER CODE ACADEMY

A local-first, role-based programming learning platform built with a vanilla HTML/CSS/JavaScript frontend and a Node.js + Express + SQLite backend.

## Included

- Single sign-in / learner registration experience.
- Learner email verification codes (SMTP delivery when configured; development code printed in server terminal).
- Administrator, teacher and learner roles with server-side permission checks.
- Password hashing with bcrypt, secure session cookies, rate limiting, Helmet security headers and CSRF tokens.
- Optional authenticator-app two-factor authentication (TOTP).
- Admin account creation, learner approval, teacher assignment and account status controls.
- Teacher learner list, marks and feedback, requests to administration, and lesson invitations.
- Relationship-limited private messaging with automatic refresh.
- Course catalogue and YouTube embed player.
- Optional OpenAI-powered programming tutor (API key stays on the server).
- SQLite database stored in `data/`.

## Requirements

- Windows 10/11
- Node.js 20 or newer
- Internet connection for first dependency installation and externally hosted YouTube/Google Fonts content

## Run on Windows

1. Extract the folder.
2. Open the `CIPHER-CODE-ACADEMY` folder.
3. Copy `.env.example` and rename the copy to `.env`.
4. Change `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in `.env`.
   - Use a unique administrator password of at least 10 characters.
   - Set `SESSION_SECRET` to a long random value (at least 32 characters).
5. Double-click `START-CIPHER-ACADEMY.bat`.
6. Open `http://localhost:3000`.

The first administrator is created automatically when the database is first initialised and the `ADMIN_EMAIL` / `ADMIN_PASSWORD` values are present. Keep the `.env` file private.

## Email verification

For local testing without SMTP, registration verification codes appear in the terminal running the server. This is development-only. For real users, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` and `MAIL_FROM` in `.env`. Never deploy with development code logging enabled.

## Two-factor authentication

After signing in, open **Security**, choose **Set up authenticator**, scan the QR code with an authenticator app, then enter the current six-digit code. On subsequent sign-ins, the authenticator code is required.

## AI tutor

Add your OpenAI API key to `OPENAI_API_KEY` in the server `.env`. The browser never receives this key. Keep the key secret and set usage limits in your provider account.

## YouTube lessons

Administrators and teachers can add a course from **Learning library** and paste a YouTube URL or its 11-character video ID. The starter catalogue includes video lessons for Python, JavaScript, HTML/CSS, Java, C, C++, C#, SQL, React and Git. Lessons play in the academy using YouTube's privacy-enhanced embed host. Some videos cannot be embedded if their owner has disabled embedding.

## Zoom lessons

Teachers can schedule Zoom lessons from **Live lessons** for active learners assigned to them. The academy creates the Zoom meeting, shows the host launch link only to the teacher, gives learners the join link, and supports cancelling the lesson and its Zoom meeting.

### Configure Zoom

1. Create a Zoom **Server-to-Server OAuth** app in the Zoom Marketplace and activate it.
2. Grant the app the account-level scopes `meeting:write:meeting:admin` and `meeting:delete:meeting:admin`.
3. Add the following values to the server's private `.env` file using the values from the Zoom app:
   - `ZOOM_ACCOUNT_ID`
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`
   - `ZOOM_HOST_USER_ID` — the Zoom user ID or email address that will host academy lessons.
4. Restart the academy server.

The Zoom host must be an active user in the configured Zoom account and have permission to schedule meetings. The Zoom client secret stays on the server and is never sent to the browser. Meeting times are converted from the teacher's local timezone to UTC before scheduling. Without Zoom configuration, the page explains that scheduling is unavailable; existing meetings can still be joined from their saved links.

## Database

SQLite is used for local development. Back up `data/cipher-academy.sqlite` and keep the backup private. A PostgreSQL migration is a separate production deployment step; do not simply change a connection string.

## Before public release — required hardening

This is a functional local development release, not a security-audited production service. Before opening registration to the public:

- Deploy behind HTTPS and set `NODE_ENV=production`.
- Set a unique, randomly generated `SESSION_SECRET`; use secure environment-variable storage.
- Configure real SMTP delivery and test email verification, recovery and deliverability.
- Add a reviewed password-reset workflow and account recovery policy.
- Add privacy policy, terms, safeguarding/contact process and data retention rules.
- Add database backups, restore testing, monitoring and administrator audit logs.
- Review access-control rules and test all roles with separate accounts.
- Migrate to a managed PostgreSQL database for production scale.
- Configure Zoom OAuth if automatic meeting creation is required.
- Add moderation, reporting and retention controls before enabling broad community features.

## Logo and existing content

The original CIPHER logo and the user's previous Academy website source were not attached to this generation session. The interface therefore uses a temporary typographic CIPHER mark and a fresh starter course catalogue. Replace `public/assets/brand-logo.svg` with the approved logo when supplied; upload the existing Academy project/source if its exact previous page content must be preserved.
