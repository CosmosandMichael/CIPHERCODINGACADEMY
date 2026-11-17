const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const dbFile = process.env.DATABASE_FILE || "./data/cipher-academy.sqlite";
const resolved = path.isAbsolute(dbFile) ? dbFile : path.join(__dirname, "..", dbFile);
fs.mkdirSync(path.dirname(resolved), { recursive: true });
const db = new Database(resolved);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'learner' CHECK(role IN ('admin','teacher','learner')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
 teacher_id INTEGER REFERENCES users(id),
 email_verified INTEGER NOT NULL DEFAULT 0,
 totp_secret TEXT,
 totp_enabled INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS verification_codes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 sender_id INTEGER NOT NULL REFERENCES users(id),
 recipient_id INTEGER NOT NULL REFERENCES users(id),
 body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT
);
CREATE TABLE IF NOT EXISTS courses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 language TEXT NOT NULL,
 description TEXT NOT NULL,
 level TEXT NOT NULL DEFAULT 'Beginner',
 video_id TEXT,
 published INTEGER NOT NULL DEFAULT 1,
 created_by INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS marks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 learner_id INTEGER NOT NULL REFERENCES users(id),
 teacher_id INTEGER NOT NULL REFERENCES users(id),
 title TEXT NOT NULL,
 score REAL NOT NULL,
 max_score REAL NOT NULL,
 feedback TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lesson_invites (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 teacher_id INTEGER NOT NULL REFERENCES users(id),
 learner_id INTEGER NOT NULL REFERENCES users(id),
 title TEXT NOT NULL,
 meeting_url TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 zoom_meeting_id TEXT,
 start_url TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS teacher_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 teacher_id INTEGER NOT NULL REFERENCES users(id),
 learner_id INTEGER NOT NULL REFERENCES users(id),
 request_type TEXT NOT NULL,
 details TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const inviteColumns = new Set(db.pragma("table_info(lesson_invites)").map(column => column.name));
if (!inviteColumns.has("zoom_meeting_id")) db.exec("ALTER TABLE lesson_invites ADD COLUMN zoom_meeting_id TEXT");
if (!inviteColumns.has("start_url")) db.exec("ALTER TABLE lesson_invites ADD COLUMN start_url TEXT");

function seed() {
 const count = db.prepare("SELECT COUNT(*) AS n FROM courses").get().n;
 if (!count) {
  const insert = db.prepare("INSERT INTO courses(title,language,description,level,video_id) VALUES(?,?,?,?,?)");
  const rows = [
   ["Python foundations","Python","Learn variables, conditions, loops, functions and problem solving.","Beginner","ix9cRaBkVe0"],
   ["JavaScript essentials","JavaScript","Build interactive websites with modern JavaScript.","Beginner","lfmg-EJ8gm4"],
   ["HTML: structure the web","HTML","Create accessible, semantic page structures.","Beginner","HGTJBPNC-Gw"],
   ["CSS: design interfaces","CSS","Learn layouts, responsive design, animation and visual systems.","Beginner","HGTJBPNC-Gw"],
   ["Java programming","Java","Understand object-oriented programming and core Java syntax.","Intermediate","xTtL8E4LzTQ"],
   ["C programming","C","Explore memory, data types, functions and systems fundamentals.","Intermediate","xND0t1pr3KY"],
   ["C++ programming","C++","Build strong foundations in C++ and object-oriented design.","Intermediate","-TkoO8Z07hI"],
   ["SQL and databases","SQL","Query, organise and understand relational data.","Beginner","5OdVJbNCSso"],
   ["React fundamentals","React","Build component-based user interfaces.","Intermediate","CgkZ7MvWUAA"],
   ["Git and GitHub","Git","Track changes and collaborate on software projects.","Beginner","mAFoROnOfHs"]
  ];
  const tx = db.transaction(() => rows.forEach(r => insert.run(...r)));
  tx();
 }
 const addCourse = db.prepare("INSERT INTO courses(title,language,description,level,video_id) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title=? AND language=?)");
 addCourse.run("C# programming", "C#", "Learn C# syntax, object-oriented programming and .NET fundamentals.", "Beginner", "wxznTygnRfQ", "C# programming", "C#");
 const seedVideos = [
  ["ix9cRaBkVe0", "Python foundations", "Python"],
  ["lfmg-EJ8gm4", "JavaScript essentials", "JavaScript"],
  ["HGTJBPNC-Gw", "HTML: structure the web", "HTML"],
  ["HGTJBPNC-Gw", "CSS: design interfaces", "CSS"],
  ["xTtL8E4LzTQ", "Java programming", "Java"],
  ["xND0t1pr3KY", "C programming", "C"],
  ["-TkoO8Z07hI", "C++ programming", "C++"],
  ["5OdVJbNCSso", "SQL and databases", "SQL"],
  ["CgkZ7MvWUAA", "React fundamentals", "React"],
  ["mAFoROnOfHs", "Git and GitHub", "Git"],
  ["wxznTygnRfQ", "C# programming", "C#"]
 ];
 const attachVideo = db.prepare("UPDATE courses SET video_id=? WHERE title=? AND language=? AND (video_id IS NULL OR video_id='')");
 const attachVideos = db.transaction(() => seedVideos.forEach(row => attachVideo.run(...row)));
 attachVideos();
 const email = process.env.ADMIN_EMAIL;
 const password = process.env.ADMIN_PASSWORD;
 if (email && password && !db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()) {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT OR IGNORE INTO users(name,email,password_hash,role,status,email_verified) VALUES(?,?,?,'admin','active',1)")
    .run(process.env.ADMIN_NAME || "Academy Administrator", email, hash);
  console.log(`Initial administrator configured: ${email}`);
 }
}
seed();

function publicUser(id) {
 return db.prepare("SELECT id,name,email,role,status,teacher_id,email_verified,totp_enabled,created_at FROM users WHERE id=?").get(id) || null;
}
module.exports = { db, publicUser };
