const router = require("express").Router();
const { db } = require("../db");
const { requireAuth, allow } = require("../middleware");
const { youtubeVideoId } = require("../youtube");
const { ZoomApiError, isZoomConfigured, createZoomMeeting, deleteZoomMeeting } = require("../zoom");

router.use(requireAuth);

router.get("/me", (req,res)=>res.json({user:req.user}));
router.get("/courses", (req,res)=>res.json(db.prepare("SELECT * FROM courses WHERE published=1 ORDER BY language,title").all()));
router.post("/courses", allow("admin","teacher"), (req,res)=>{
 const {title,language,description,level,videoId}=req.body;
 if (![title,language,description].every(x=>typeof x==="string" && x.trim().length>1)) return res.status(400).json({error:"Complete all course fields."});
 const normalizedVideoId = videoId ? youtubeVideoId(videoId) : null;
 if (videoId && !normalizedVideoId) return res.status(400).json({error:"Use a valid YouTube URL or 11-character video ID."});
 const r=db.prepare("INSERT INTO courses(title,language,description,level,video_id,created_by) VALUES(?,?,?,?,?,?)")
  .run(title.trim().slice(0,100),language.trim().slice(0,40),description.trim().slice(0,500),String(level||"Beginner"),normalizedVideoId,req.user.id);
 res.status(201).json({id:r.lastInsertRowid});
});

router.get("/admin/overview",allow("admin"),(req,res)=>{
 const counts=db.prepare("SELECT role,status,COUNT(*) count FROM users GROUP BY role,status").all();
 const pending=db.prepare("SELECT id,name,email,created_at,email_verified FROM users WHERE role='learner' AND status='pending' ORDER BY created_at DESC").all();
 const people=db.prepare("SELECT id,name,email,role,status,teacher_id,created_at FROM users ORDER BY created_at DESC LIMIT 200").all();
 const teachers=db.prepare("SELECT id,name,email FROM users WHERE role='teacher' AND status='active' ORDER BY name").all();
 res.json({counts,pending,people,teachers});
});
router.post("/admin/users",allow("admin"),async(req,res)=>{
 const bcrypt=require("bcryptjs");
 const {name,email,password,role}=req.body;
 if(!name||!email||!password||!["teacher","learner"].includes(role)||String(password).length<10) return res.status(400).json({error:"Provide name, email, a 10+ character password and a valid role."});
 try{
  const r=db.prepare("INSERT INTO users(name,email,password_hash,role,status,email_verified) VALUES(?,?,?,?, 'active',1)")
   .run(String(name).trim().slice(0,80),String(email).trim().toLowerCase(),await bcrypt.hash(String(password),12),role);
  res.status(201).json({id:r.lastInsertRowid,message:`${role} account created.`});
 }catch(e){res.status(409).json({error:"That email may already be registered."});}
});
router.post("/admin/approve",allow("admin"),(req,res)=>{
 const id=Number(req.body.userId), teacherId=req.body.teacherId?Number(req.body.teacherId):null;
 const learner=db.prepare("SELECT id FROM users WHERE id=? AND role='learner'").get(id);
 if(!learner)return res.status(404).json({error:"Learner not found."});
 if(teacherId && !db.prepare("SELECT id FROM users WHERE id=? AND role='teacher' AND status='active'").get(teacherId)) return res.status(400).json({error:"Choose an active teacher."});
 db.prepare("UPDATE users SET status='active',teacher_id=? WHERE id=?").run(teacherId,id);
 res.json({message:"Learner approved and teacher assignment saved."});
});
router.post("/admin/assign-teacher",allow("admin"),(req,res)=>{
 const learnerId=Number(req.body.learnerId), teacherId=Number(req.body.teacherId);
 if(!db.prepare("SELECT id FROM users WHERE id=? AND role='learner' AND status='active'").get(learnerId)||!db.prepare("SELECT id FROM users WHERE id=? AND role='teacher' AND status='active'").get(teacherId))return res.status(400).json({error:"Select an active learner and teacher."});
 db.prepare("UPDATE users SET teacher_id=? WHERE id=?").run(teacherId,learnerId);res.json({message:"Teacher assignment updated."});
});
router.post("/admin/status",allow("admin"),(req,res)=>{
 const {userId,status}=req.body;if(!["active","suspended"].includes(status))return res.status(400).json({error:"Invalid status."});
 db.prepare("UPDATE users SET status=? WHERE id=? AND role!='admin'").run(status,Number(userId));res.json({message:"Account status updated."});
});

router.get("/teacher/learners",allow("teacher"),(req,res)=>{
 res.json(db.prepare("SELECT id,name,email,created_at FROM users WHERE role='learner' AND teacher_id=? AND status='active' ORDER BY name").all(req.user.id));
});
router.get("/teacher/zoom-status",allow("teacher"),(req,res)=>res.json({configured:isZoomConfigured()}));
router.post("/teacher/marks",allow("teacher"),(req,res)=>{
 const learnerId=Number(req.body.learnerId),score=Number(req.body.score),max=Number(req.body.maxScore),title=String(req.body.title||"").trim();
 const learner=db.prepare("SELECT id FROM users WHERE id=? AND role='learner' AND teacher_id=?").get(learnerId,req.user.id);
 if(!learner||!title||!Number.isFinite(score)||!Number.isFinite(max)||max<=0||score<0||score>max)return res.status(400).json({error:"Check learner, assessment title and score values."});
 db.prepare("INSERT INTO marks(learner_id,teacher_id,title,score,max_score,feedback) VALUES(?,?,?,?,?,?)").run(learnerId,req.user.id,title,score,max,String(req.body.feedback||"").slice(0,500));
 res.status(201).json({message:"Mark saved."});
});
router.get("/marks", (req,res)=>{
 const rows=req.user.role==="learner"
  ?db.prepare("SELECT m.*,u.name teacher_name FROM marks m JOIN users u ON u.id=m.teacher_id WHERE learner_id=? ORDER BY m.created_at DESC").all(req.user.id)
  :req.user.role==="teacher"
   ?db.prepare("SELECT m.*,u.name learner_name FROM marks m JOIN users u ON u.id=m.learner_id WHERE teacher_id=? ORDER BY m.created_at DESC").all(req.user.id)
   :db.prepare("SELECT m.*,u.name learner_name,t.name teacher_name FROM marks m JOIN users u ON u.id=m.learner_id JOIN users t ON t.id=m.teacher_id ORDER BY m.created_at DESC LIMIT 200").all();
 res.json(rows);
});

router.get("/messages/contacts",(req,res)=>{
 let rows=[];
 if(req.user.role==="learner"){
  if(req.user.teacher_id) rows=db.prepare("SELECT id,name,role FROM users WHERE id=?").all(req.user.teacher_id);
 }else if(req.user.role==="teacher"){
  rows=db.prepare("SELECT id,name,role FROM users WHERE teacher_id=? AND role='learner' AND status='active'").all(req.user.id);
 }else rows=db.prepare("SELECT id,name,role FROM users WHERE id!=? AND status='active' ORDER BY name LIMIT 100").all(req.user.id);
 res.json(rows);
});
router.get("/messages/:otherId",(req,res)=>{
 const other=Number(req.params.otherId);
 const allowed=canMessage(req.user,other);
 if(!allowed)return res.status(403).json({error:"Messaging is limited to your academy relationships."});
 db.prepare("UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE sender_id=? AND recipient_id=? AND read_at IS NULL").run(other,req.user.id);
 res.json(db.prepare("SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,m.read_at,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?) ORDER BY m.id DESC LIMIT 100").all(req.user.id,other,other,req.user.id).reverse());
});
router.post("/messages",(req,res)=>{
 const recipient=Number(req.body.recipientId),body=String(req.body.body||"").trim();
 if(!body||body.length>2000||!canMessage(req.user,recipient))return res.status(400).json({error:"Message is empty, too long, or recipient is not available."});
 db.prepare("INSERT INTO messages(sender_id,recipient_id,body) VALUES(?,?,?)").run(req.user.id,recipient,body);
 res.status(201).json({message:"Message sent."});
});
function canMessage(user,otherId){
 const other=db.prepare("SELECT id,role,teacher_id,status FROM users WHERE id=?").get(otherId);
 if(!other||other.status!=="active"||other.id===user.id)return false;
 if(user.role==="admin")return true;
 if(user.role==="learner")return other.id===user.teacher_id||(other.role==="teacher"&&other.teacher_id===user.id);
 if(user.role==="teacher")return other.role==="learner"&&other.teacher_id===user.id;
 return false;
}

router.post("/teacher/invites",allow("teacher"),async(req,res,next)=>{
 const learnerId=Number(req.body.learnerId),title=String(req.body.title||"").trim(),startsAt=String(req.body.startsAt||"").trim(),duration=Number(req.body.duration);
 const startsDate=new Date(startsAt);
 if(!Number.isSafeInteger(learnerId)||!db.prepare("SELECT id FROM users WHERE id=? AND role='learner' AND teacher_id=? AND status='active'").get(learnerId,req.user.id))return res.status(400).json({error:"Choose an active learner assigned to you."});
 if(title.length<2||title.length>100)return res.status(400).json({error:"Enter a lesson title between 2 and 100 characters."});
 if(!Number.isFinite(startsDate.getTime())||startsDate.getTime()<Date.now()+60_000)return res.status(400).json({error:"Choose a start time at least one minute in the future."});
 if(!Number.isInteger(duration)||duration<15||duration>240)return res.status(400).json({error:"Lesson duration must be between 15 and 240 minutes."});
 if(!isZoomConfigured())return res.status(503).json({error:"Zoom is not configured. Add the Zoom Server-to-Server OAuth settings to the server environment and restart the academy."});
 try{
  const meeting=await createZoomMeeting({title,startsAt:startsDate.toISOString(),duration});
  if(!meeting.id||!meeting.join_url||!meeting.start_url)throw new ZoomApiError("Zoom did not return all meeting details. Check the app permissions and host account.",502);
  const result=db.prepare("INSERT INTO lesson_invites(teacher_id,learner_id,title,meeting_url,starts_at,zoom_meeting_id,start_url) VALUES(?,?,?,?,?,?,?)")
   .run(req.user.id,learnerId,title,meeting.join_url,startsDate.toISOString(),String(meeting.id),meeting.start_url);
  res.status(201).json({id:result.lastInsertRowid,message:"Zoom meeting created and invitation added to the learner's Live lessons."});
 }catch(error){
  if(error instanceof ZoomApiError)return res.status(error.status).json({error:error.message});
  next(error);
 }
});
router.delete("/teacher/invites/:inviteId",allow("teacher"),async(req,res,next)=>{
 const inviteId=Number(req.params.inviteId);
 if(!Number.isSafeInteger(inviteId)||inviteId<1)return res.status(400).json({error:"Invalid lesson invitation."});
 const invite=db.prepare("SELECT id,zoom_meeting_id FROM lesson_invites WHERE id=? AND teacher_id=?").get(inviteId,req.user.id);
 if(!invite)return res.status(404).json({error:"Lesson invitation not found."});
 try{
  if(invite.zoom_meeting_id){
   if(!isZoomConfigured())return res.status(503).json({error:"Zoom is not configured. Configure Zoom before cancelling this meeting."});
   await deleteZoomMeeting(invite.zoom_meeting_id);
  }
  db.prepare("DELETE FROM lesson_invites WHERE id=? AND teacher_id=?").run(inviteId,req.user.id);
  res.json({message:"Lesson cancelled."});
 }catch(error){
  if(error instanceof ZoomApiError)return res.status(error.status).json({error:error.message});
  next(error);
 }
});
router.get("/invites",(req,res)=>{
 const rows=req.user.role==="learner"
  ?db.prepare("SELECT i.id,i.title,i.meeting_url,i.starts_at,i.created_at,u.name teacher_name FROM lesson_invites i JOIN users u ON u.id=i.teacher_id WHERE learner_id=? ORDER BY starts_at").all(req.user.id)
  :req.user.role==="teacher"
   ?db.prepare("SELECT i.id,i.title,i.meeting_url,i.starts_at,i.zoom_meeting_id,i.start_url,i.created_at,u.name learner_name FROM lesson_invites i JOIN users u ON u.id=i.learner_id WHERE teacher_id=? ORDER BY starts_at").all(req.user.id)
   :db.prepare("SELECT i.id,i.title,i.meeting_url,i.starts_at,i.created_at,t.name teacher_name,l.name learner_name FROM lesson_invites i JOIN users t ON t.id=i.teacher_id JOIN users l ON l.id=i.learner_id ORDER BY starts_at DESC LIMIT 100").all();
 res.json(rows);
});
router.post("/teacher/requests",allow("teacher"),(req,res)=>{
 const learnerId=Number(req.body.learnerId),type=String(req.body.type||"").slice(0,40),details=String(req.body.details||"").trim();
 if(!db.prepare("SELECT id FROM users WHERE id=? AND role='learner' AND teacher_id=?").get(learnerId,req.user.id)||!details)return res.status(400).json({error:"Select your assigned learner and provide details."});
 db.prepare("INSERT INTO teacher_requests(teacher_id,learner_id,request_type,details) VALUES(?,?,?,?)").run(req.user.id,learnerId,type,details.slice(0,1000));
 res.json({message:"Request sent to administration."});
});
router.get("/admin/requests",allow("admin"),(req,res)=>res.json(db.prepare("SELECT r.*,t.name teacher_name,l.name learner_name FROM teacher_requests r JOIN users t ON t.id=r.teacher_id JOIN users l ON l.id=r.learner_id ORDER BY r.created_at DESC").all()));

router.post("/ai/tutor",async(req,res)=>{
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"AI tutor is not configured yet. Add OPENAI_API_KEY to the server .env file."});
 const prompt=String(req.body.prompt||"").trim();if(!prompt||prompt.length>4000)return res.status(400).json({error:"Enter a question up to 4,000 characters."});
 try{
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",messages:[{role:"system",content:"You are CIPHER Code Academy's supportive programming tutor. Explain concepts clearly, use small examples, encourage understanding, and do not claim to execute code."},{role:"user",content:prompt}],temperature:0.4})});
  const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"AI provider error");
  res.json({answer:data.choices?.[0]?.message?.content||"No response returned."});
 }catch(e){res.status(502).json({error:"AI tutor request failed. Check the server configuration and provider account."});}
});

module.exports=router;
