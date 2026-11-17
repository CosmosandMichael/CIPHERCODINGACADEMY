const $ = s => document.querySelector(s);
let csrfToken = "";
let currentUser = null;
let activeContact = null;
let contacts = [];
let currentPage = "overview";
const navItems = [
 ["overview","Overview","◫",["admin","teacher","learner"]],
 ["courses","Learning library","⌘",["admin","teacher","learner"]],
 ["classroom","Classroom videos","▷",["admin","teacher","learner"]],
 ["people","People & enrolment","♙",["admin"]],
 ["learners","My learners","♧",["teacher"]],
 ["marks","Marks & progress","▤",["admin","teacher","learner"]],
 ["messages","Messages","✉",["admin","teacher","learner"]],
 ["lessons","Live lessons","◷",["teacher","learner","admin"]],
 ["ai","AI tutor","✳",["admin","teacher","learner"]],
 ["security","Security","⌑",["admin","teacher","learner"]]
];
const authForms = ["loginForm","registerForm","verifyForm"];
function notice(message,error=false){const n=$("#authMessage");n.textContent=message;n.className="notice"+(error?" error":"");n.classList.remove("hidden")}
function toast(message){const t=$("#toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
async function api(url,options={}) {
 const method=(options.method||"GET").toUpperCase();
 const headers={"Content-Type":"application/json",...(options.headers||{})};
 if(!["GET","HEAD","OPTIONS"].includes(method))headers["x-csrf-token"]=csrfToken;
 const r=await fetch("/api"+url,{...options,headers,credentials:"same-origin"});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||"Request failed");
 return data;
}
function showAuth(mode="login"){
 $("#authView").classList.remove("hidden");$("#appView").classList.add("hidden");
 const activeForm=mode==="verifyForm"?mode:`${mode}Form`;
 authForms.forEach(id=>$("#"+id).classList.toggle("hidden",id!==activeForm));
 $("#authMessage").classList.add("hidden");
 const register=mode==="register";
 $("#authTitle").textContent=register?"Start learning.":mode==="verifyForm"?"Verify your email.":"Welcome back.";
 $("#authSubtitle").textContent=register?"Create your learner account. Administrator approval is required.":mode==="verifyForm"?"Enter the six-digit code sent to your email.":"Sign in to continue your learning journey.";
 $("#switchText").textContent=register?"Already have an account?":"New to CIPHER?";
 $("#switchMode").textContent=register?"Sign in":"Create an account";
}
$("#switchMode").addEventListener("click",()=>showAuth($("#registerForm").classList.contains("hidden")?"register":"login"));
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);try{const d=await api("/auth/login",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});currentUser=d.user;csrfToken=d.csrfToken;renderApp()}catch(err){notice(err.message,true);if(err.message.includes("authenticator"))$("#totpWrap").classList.remove("hidden")}
});
$("#registerForm").addEventListener("submit",async e=>{
 e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{const result=await api("/auth/register",{method:"POST",body:JSON.stringify(d)});showAuth("verifyForm");$("#verifyForm [name=email]").value=d.email;notice(result.message)}catch(err){notice(err.message,true)}
});
$("#verifyForm").addEventListener("submit",async e=>{
 e.preventDefault();try{const result=await api("/auth/verify-email",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});showAuth("login");notice(result.message)}catch(err){notice(err.message,true)}
});
$("#logoutBtn").addEventListener("click",async()=>{try{await api("/auth/logout",{method:"POST",body:"{}"})}catch{}currentUser=null;showAuth("login")});
async function init(){
 try{const b=await fetch("/api/bootstrap").then(r=>r.json());csrfToken=b.csrfToken;if(b.user){currentUser=b.user;renderApp()}else showAuth("login")}catch{showAuth("login")}
}
function renderApp(){
 $("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");
 $("#sideName").textContent=currentUser.name;$("#sideRole").textContent=currentUser.role.toUpperCase();
 $("#avatarInitial").textContent=currentUser.name[0].toUpperCase();$("#headAvatar").textContent=currentUser.name[0].toUpperCase();
 const nav=navItems.filter(x=>x[3].includes(currentUser.role));
 $("#sideNav").innerHTML=nav.map(x=>`<button class="nav-item ${currentPage===x[0]?"active":""}" data-page="${x[0]}"><span class="nav-icon">${x[2]}</span>${x[1]}</button>`).join("");
 $("#sideNav").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
 go(currentPage);
}
async function go(page){
 currentPage=page;$("#sideNav").querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 const titles={overview:"Overview",courses:"Learning library",classroom:"Classroom videos",people:"People & enrolment",learners:"My learners",marks:"Marks & progress",messages:"Messages",lessons:"Live lessons",ai:"AI learning assistant",security:"Account security"};
 $("#pageTitle").textContent=titles[page]||"Workspace";$("#pageEyebrow").textContent=`${currentUser.role.toUpperCase()} WORKSPACE`;
 const view=$("#pageContent");view.innerHTML='<div class="empty">Loading workspace…</div>';
 try{
  const renderers={overview:overview,courses:courses,classroom:classroom,people:people,learners:learners,marks:marks,messages:messages,lessons:lessons,ai:ai,security:security};
  await renderers[page](view);
 }catch(e){view.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function stat(label,value,sub){return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`}
async function overview(v){
 const [cs,ms,ivs]=await Promise.all([api("/courses"),api("/marks"),api("/invites")]);
 let extra="";
 if(currentUser.role==="admin"){const d=await api("/admin/overview");extra=stat("Pending approvals",d.pending.length,"Learners awaiting review")+stat("Teachers",d.people.filter(p=>p.role==="teacher").length,"Registered teaching staff");}
 else if(currentUser.role==="teacher"){const l=await api("/teacher/learners");extra=stat("My learners",l.length,"Assigned active learners")+stat("Assessments",ms.length,"Marks recorded");}
 else extra=stat("Assessments",ms.length,"Your recorded results")+stat("Upcoming lessons",ivs.length,"Invitations received");
 v.innerHTML=`<div class="welcome-row"><div><h2>Good to see you, ${esc(currentUser.name.split(" ")[0])}.</h2><p>Your next step starts here. Keep learning, keep building.</p></div><span class="live-pill"><i></i> PERSONAL WORKSPACE</span></div><div class="grid stats-grid">${stat("Learning modules",cs.length,"Available courses")}${stat("Your role",currentUser.role.toUpperCase(),"Workspace access")}${extra}</div><div class="grid two-col"><div class="panel"><div class="panel-head"><div><h3>Explore the learning library</h3><div class="panel-sub">Programming paths and practical foundations</div></div><button class="text-button" data-go="courses">View all →</button></div><div class="course-grid">${cs.slice(0,2).map(courseCard).join("")}</div></div><div class="panel"><div class="panel-head"><h3>Learning principles</h3></div><p class="panel-sub">Learn by understanding. Practise consistently. Build projects that solve real problems.</p><div class="settings-note">CIPHER is designed around clear learning paths, teacher guidance and a supportive developer community.</div><button class="btn btn-secondary" style="margin-top:20px;width:100%" data-go="ai">Ask the AI tutor →</button></div></div>`;
 v.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
}
function courseCard(c){const symbols={Python:"Py",JavaScript:"JS",HTML:"5",CSS:"{ }",Java:"J",C:"C", "C++":"C+", "C#":"C#",SQL:"DB",React:"R",Git:"Git"};return `<article class="course-card"><div class="course-art"><span class="course-symbol">${symbols[c.language]||"</>"}</span><span class="level">${esc(c.level)}</span></div><div class="course-body"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="course-meta"><span>${esc(c.language)}</span><button data-video="${esc(c.video_id||"")}">Open course →</button></div></div></article>`}
async function courses(v){
 const list=await api("/courses");
 v.innerHTML=`<div class="toolbar"><div><h2>Choose your next skill.</h2><p class="panel-sub">Explore the core tools used to build modern software.</p></div><input class="control search" id="courseSearch" placeholder="Search languages…"></div><div class="grid course-grid" id="courseGrid">${list.map(courseCard).join("")}</div>${currentUser.role!=="learner"?`<div class="panel" style="margin-top:20px"><h3>Add a learning module</h3><form id="courseForm" class="stack-form" style="margin-top:15px"><div class="grid two-col"><label>Course title<input class="control" name="title" required></label><label>Language / topic<input class="control" name="language" required></label></div><label>Description<textarea name="description" required></textarea></label><div class="grid two-col"><label>Level<select class="control" name="level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>YouTube URL or video ID (optional)<input class="control" name="videoId" maxlength="2048" placeholder="Paste a YouTube link or 11-character ID"></label></div><button class="btn btn-primary">Publish module →</button></form></div>`:""}`;
 $("#courseSearch").oninput=e=>{$("#courseGrid").innerHTML=list.filter(c=>(c.title+c.language+c.description).toLowerCase().includes(e.target.value.toLowerCase())).map(courseCard).join("")};
 v.querySelectorAll("[data-video]").forEach(b=>b.onclick=()=>{if(b.dataset.video){go("classroom");setTimeout(()=>loadVideo(b.dataset.video),100)}else toast("No video has been attached to this module yet.")});
 if($("#courseForm"))$("#courseForm").onsubmit=async e=>{e.preventDefault();try{await api("/courses",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast("Learning module published.");courses(v)}catch(err){toast(err.message)}};
}
async function classroom(v){
 const list=await api("/courses");
 v.innerHTML=`<div class="toolbar"><div><h2>Watch. Understand. Practise.</h2><p class="panel-sub">Embedded YouTube lessons play inside the academy.</p></div></div><div class="grid video-card"><div class="panel"><div id="videoStage" class="video-placeholder"><div><strong>Select a lesson</strong><br><span>Choose a course video to start learning.</span></div></div><h3 id="videoTitle" style="margin-top:16px">Classroom player</h3><p class="panel-sub">Videos are hosted by YouTube. Availability depends on each video's owner and embed permissions.</p></div><div class="panel"><h3>Video library</h3><div class="panel-sub" style="margin-bottom:15px">Select a module with an attached video.</div><div class="stack-form">${list.map(c=>`<button class="btn btn-secondary" style="text-align:left" data-video="${esc(c.video_id||"")}" data-title="${esc(c.title)}">${esc(c.title)} <span>${c.video_id?"▶":"Not linked"}</span></button>`).join("")}</div><p class="settings-note" style="margin-top:16px">Teachers and administrators can attach a YouTube URL or video ID when publishing a module from the Learning Library.</p></div></div>`;
 v.querySelectorAll("[data-video]").forEach(b=>b.onclick=()=>b.dataset.video?loadVideo(b.dataset.video,b.dataset.title):toast("This module has no video ID yet."));
}
function loadVideo(id,title="Lesson video"){$("#videoStage").innerHTML=`<iframe class="video-frame" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0" title="${esc(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;$("#videoTitle").textContent=title}
async function people(v){
 const d=await api("/admin/overview");
 v.innerHTML=`<div class="toolbar"><div><h2>Manage the academy.</h2><p class="panel-sub">Review learner registrations, approve access and assign teachers.</p></div></div><div class="grid stats-grid">${stat("Pending",d.pending.length,"Awaiting approval")}${stat("Learners",d.people.filter(x=>x.role==="learner").length,"Registered")}${stat("Teachers",d.teachers.length,"Active teaching staff")}${stat("All accounts",d.people.length,"Academy users")}</div><div class="panel"><div class="panel-head"><h3>Pending learner registrations</h3></div><div class="table-wrap"><table><thead><tr><th>LEARNER</th><th>EMAIL</th><th>EMAIL STATUS</th><th>ASSIGN TEACHER</th><th>ACTION</th></tr></thead><tbody>${d.pending.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.email)}</td><td><span class="badge ${p.email_verified?"active":"pending"}">${p.email_verified?"Verified":"Unverified"}</span></td><td><select class="control" id="teacher-${p.id}"><option value="">Unassigned</option>${d.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></td><td><button class="btn btn-primary approve" data-id="${p.id}">Approve</button></td></tr>`).join("")||`<tr><td colspan="5">No pending registrations.</td></tr>`}</tbody></table></div></div><div class="grid two-col" style="margin-top:18px"><div class="panel"><h3>Create an account</h3><form id="createUser" class="stack-form" style="margin-top:14px"><label>Full name<input class="control" name="name" required></label><label>Email<input class="control" name="email" type="email" required></label><label>Temporary password<input class="control" name="password" minlength="10" required></label><label>Role<select class="control" name="role"><option value="teacher">Teacher</option><option value="learner">Learner</option></select></label><button class="btn btn-primary">Create account →</button></form></div><div class="panel"><h3>Account directory</h3><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>NAME</th><th>ROLE</th><th>STATUS</th><th>CONTROL</th></tr></thead><tbody>${d.people.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.role}</td><td><span class="badge ${p.status}">${p.status}</span></td><td>${p.role==="admin"?"—":`<button class="text-button status-btn" data-id="${p.id}" data-status="${p.status==="active"?"suspended":"active"}">${p.status==="active"?"Suspend":"Activate"}</button>`}</td></tr>`).join("")}</tbody></table></div></div></div>`;
 v.querySelectorAll(".approve").forEach(b=>b.onclick=async()=>{try{await api("/admin/approve",{method:"POST",body:JSON.stringify({userId:b.dataset.id,teacherId:$("#teacher-"+b.dataset.id).value||null})});toast("Learner approved.");people(v)}catch(e){toast(e.message)}});
 $("#createUser").onsubmit=async e=>{e.preventDefault();try{await api("/admin/users",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast("Account created.");people(v)}catch(err){toast(err.message)}};
 v.querySelectorAll(".status-btn").forEach(b=>b.onclick=async()=>{try{await api("/admin/status",{method:"POST",body:JSON.stringify({userId:b.dataset.id,status:b.dataset.status})});people(v)}catch(e){toast(e.message)}});
}
async function learners(v){
 const list=await api("/teacher/learners");
 v.innerHTML=`<div class="toolbar"><div><h2>Your teaching group.</h2><p class="panel-sub">Support learners assigned to your account.</p></div></div><div class="grid course-grid">${list.map(l=>`<div class="person-card"><div class="avatar">${esc(l.name[0].toUpperCase())}</div><h3 style="margin-top:13px">${esc(l.name)}</h3><p class="panel-sub">${esc(l.email)}</p><span class="badge active">Active learner</span></div>`).join("")||'<div class="empty">No learners have been assigned to you yet.</div>'}</div>`;
}
async function marks(v){
 const rows=await api("/marks");
 let form="";
 if(currentUser.role==="teacher"){
  const ls=await api("/teacher/learners");
  form=`<div class="panel" style="margin-bottom:18px"><h3>Record learner assessment</h3><form id="markForm" class="stack-form" style="margin-top:14px"><div class="grid two-col"><label>Learner<select class="control" name="learnerId" required>${ls.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></label><label>Assessment title<input class="control" name="title" required></label></div><div class="grid two-col"><label>Score<input class="control" name="score" type="number" min="0" step=".5" required></label><label>Maximum score<input class="control" name="maxScore" type="number" min=".5" step=".5" value="100" required></label></div><label>Feedback<textarea name="feedback"></textarea></label><button class="btn btn-primary">Save mark →</button></form></div>`;
 }
 v.innerHTML=`<div class="toolbar"><div><h2>Progress and assessment.</h2><p class="panel-sub">A clear record of learning milestones and feedback.</p></div></div>${form}<div class="panel"><div class="table-wrap"><table><thead><tr><th>ASSESSMENT</th><th>${currentUser.role==="learner"?"TEACHER":"LEARNER"}</th><th>SCORE</th><th>FEEDBACK</th><th>DATE</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.learner_name||r.teacher_name||"")}</td><td>${r.score}/${r.max_score} (${Math.round(r.score/r.max_score*100)}%)</td><td>${esc(r.feedback||"—")}</td><td>${esc(r.created_at)}</td></tr>`).join("")||'<tr><td colspan="5">No marks recorded yet.</td></tr>'}</tbody></table></div></div>`;
 if($("#markForm"))$("#markForm").onsubmit=async e=>{e.preventDefault();try{await api("/teacher/marks",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast("Mark saved.");marks(v)}catch(err){toast(err.message)}};
}
async function messages(v){
 contacts=await api("/messages/contacts");
 v.innerHTML=`<div class="toolbar"><div><h2>Stay connected.</h2><p class="panel-sub">Private academy messaging between assigned learners and teachers.</p></div></div><div class="message-layout"><div class="contact-list" id="contactList">${contacts.map(c=>`<button class="contact" data-id="${c.id}">${esc(c.name)}<br><small>${c.role}</small></button>`).join("")||'<p class="panel-sub">No contacts yet.</p>'}</div><div class="chat-area"><div class="chat-header" id="chatHeader">Choose a conversation</div><div class="chat-log" id="chatLog"><div class="empty">Select a contact to view messages.</div></div><form id="chatForm" class="chat-compose"><input class="control" name="body" maxlength="2000" placeholder="Write a message…" required><button class="btn btn-primary">Send</button></form></div></div>`;
 v.querySelectorAll(".contact").forEach(b=>b.onclick=()=>selectContact(Number(b.dataset.id),b.textContent.split("\n")[0]));
 $("#chatForm").onsubmit=async e=>{e.preventDefault();if(!activeContact)return toast("Choose a contact first.");const body=new FormData(e.currentTarget).get("body");try{await api("/messages",{method:"POST",body:JSON.stringify({recipientId:activeContact,body})});e.currentTarget.reset();await loadMessages()}catch(err){toast(err.message)}};
}
async function selectContact(id,name){activeContact=id;$("#chatHeader").textContent=name;document.querySelectorAll(".contact").forEach(b=>b.classList.toggle("active",Number(b.dataset.id)===id));await loadMessages();if(window.chatTimer)clearInterval(window.chatTimer);window.chatTimer=setInterval(()=>loadMessages(true),5000)}
async function loadMessages(silent=false){if(!activeContact)return;try{const rows=await api("/messages/"+activeContact);$("#chatLog").innerHTML=rows.map(m=>`<div class="bubble ${m.sender_id===currentUser.id?"mine":""}">${esc(m.body)}<small>${esc(m.sender_name)} · ${esc(m.created_at)}</small></div>`).join("")||'<div class="empty">No messages yet. Start the conversation.</div>';$("#chatLog").scrollTop=$("#chatLog").scrollHeight}catch(e){if(!silent)toast(e.message)}}
async function lessons(v){
 const rows=await api("/invites");
 let form="";
 if(currentUser.role==="teacher"){
  const [ls,zoomStatus]=await Promise.all([api("/teacher/learners"),api("/teacher/zoom-status")]);
  const minTime=new Date(Date.now()+60_000),localMin=new Date(minTime.getTime()-minTime.getTimezoneOffset()*60_000).toISOString().slice(0,16);
  const configNote=zoomStatus.configured?"":'<div class="notice error" style="margin-top:14px">Zoom is not configured. Ask the administrator to add the Zoom OAuth settings and restart the academy.</div>';
  form=`<div class="panel" style="margin-bottom:18px"><h3>Schedule a Zoom lesson</h3><p class="panel-sub">Create a Zoom meeting and add it to your assigned learner's Live lessons. Times are shown in your local timezone (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}).</p>${configNote}${ls.length?`<form id="inviteForm" class="stack-form" style="margin-top:13px"><div class="grid two-col"><label>Learner<select class="control" name="learnerId" required>${ls.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></label><label>Lesson title<input class="control" name="title" maxlength="100" required></label></div><div class="grid two-col"><label>Start time<input class="control" name="startsAt" type="datetime-local" min="${localMin}" required></label><label>Duration<select class="control" name="duration"><option value="30">30 minutes</option><option value="45" selected>45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label></div><button class="btn btn-primary" ${zoomStatus.configured?"":"disabled"}>Create Zoom lesson →</button></form>`:'<div class="empty" style="margin-top:15px">Assign active learners to your account before scheduling lessons.</div>'}</div>`;
 }
 const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?esc(value):esc(date.toLocaleString())};
 const lessonCards=rows.map(r=>{
  const teacher=currentUser.role==="teacher",person=teacher?r.learner_name:r.teacher_name;
  const joinUrl=teacher?(r.start_url||r.meeting_url):r.meeting_url;
  const action=joinUrl?`<a class="btn btn-secondary" style="text-decoration:none;margin-top:15px" href="${esc(joinUrl)}" target="_blank" rel="noopener noreferrer">${teacher&&r.start_url?"Start Zoom lesson ↗":"Join Zoom lesson ↗"}</a>`:"";
  const cancel=teacher?`<button class="text-button cancel-lesson" style="margin-top:14px" data-id="${r.id}">Cancel lesson</button>`:"";
  return `<div class="person-card"><span class="badge ${new Date(r.starts_at).getTime()>=Date.now()?"active":"pending"}">${new Date(r.starts_at).getTime()>=Date.now()?"SCHEDULED":"PAST LESSON"}</span><h3 style="margin-top:12px">${esc(r.title)}</h3><p class="panel-sub">${esc(person||"Academy member")}</p><p class="panel-sub">${dateLabel(r.starts_at)}</p>${action}${cancel}</div>`;
 }).join("");
 v.innerHTML=`<div class="toolbar"><div><h2>Live learning sessions.</h2><p class="panel-sub">Create, manage and join teacher-led Zoom lessons.</p></div></div>${form}<div class="grid course-grid">${lessonCards||'<div class="empty">No live lessons scheduled yet.</div>'}</div>`;
 if($("#inviteForm"))$("#inviteForm").onsubmit=async e=>{
  e.preventDefault();
  const formData=Object.fromEntries(new FormData(e.currentTarget));
  formData.startsAt=new Date(formData.startsAt).toISOString();
  try{const result=await api("/teacher/invites",{method:"POST",body:JSON.stringify(formData)});toast(result.message);lessons(v)}catch(err){toast(err.message)}
 };
 v.querySelectorAll(".cancel-lesson").forEach(button=>button.onclick=async()=>{
  if(!confirm("Cancel this lesson and delete its Zoom meeting?"))return;
  try{const result=await api(`/teacher/invites/${button.dataset.id}`,{method:"DELETE"});toast(result.message);lessons(v)}catch(err){toast(err.message)}
 });
}
async function ai(v){
 v.innerHTML=`<div class="toolbar"><div><h2>Your programming study partner.</h2><p class="panel-sub">Ask questions, request explanations or get help understanding code.</p></div><span class="badge">AI POWERED · OPTIONAL</span></div><div class="panel"><form id="aiForm" class="stack-form"><label>What are you working on?<textarea name="prompt" maxlength="4000" placeholder="Explain JavaScript functions with a simple example…" required></textarea></label><button class="btn btn-primary" style="max-width:220px">Ask CIPHER tutor →</button></form><div id="aiAnswer" class="ai-answer hidden"></div><p class="settings-note" style="margin-top:15px">The AI tutor is disabled until the academy administrator adds an OpenAI API key to the server's .env file. Never share passwords or private account information with an AI assistant.</p></div>`;
 $("#aiForm").onsubmit=async e=>{e.preventDefault();$("#aiAnswer").classList.remove("hidden");$("#aiAnswer").textContent="Thinking…";try{const d=await api("/ai/tutor",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});$("#aiAnswer").textContent=d.answer}catch(err){$("#aiAnswer").textContent=err.message}};
}
async function security(v){
 v.innerHTML=`<div class="toolbar"><div><h2>Protect your account.</h2><p class="panel-sub">Add an authenticator app as a second verification layer.</p></div></div><div class="grid two-col"><div class="panel"><h3>Two-factor authentication</h3><p class="panel-sub">Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.</p><div id="totpSetup" class="settings-note" style="margin:15px 0">Two-factor authentication is ${currentUser.totp_enabled?"enabled":"not enabled"} for this account.</div><button id="setup2fa" class="btn btn-primary">${currentUser.totp_enabled?"Set up again":"Set up authenticator"} →</button><form id="confirm2fa" class="stack-form hidden" style="margin-top:15px"><img id="qrImage" alt="Authenticator setup QR code" style="width:180px;background:white;padding:8px;border-radius:8px"><label>Enter the current six-digit code<input class="control" name="code" inputmode="numeric" maxlength="6" required></label><button class="btn btn-primary">Enable two-factor →</button></form></div><div class="panel"><h3>Account details</h3><p class="panel-sub">Signed in as</p><p>${esc(currentUser.name)}</p><p class="panel-sub">${esc(currentUser.email)}</p><span class="badge active">${currentUser.role.toUpperCase()}</span><p class="settings-note" style="margin-top:20px">For public deployment, use HTTPS, a strong SESSION_SECRET, a real SMTP provider, regular database backups and a managed production database.</p></div></div>`;
 $("#setup2fa").onclick=async()=>{try{const d=await api("/auth/2fa/setup",{method:"POST",body:"{}"});$("#qrImage").src=d.qr;$("#confirm2fa").classList.remove("hidden");$("#totpSetup").textContent="Scan the QR code in your authenticator app, then enter its current code."}catch(e){toast(e.message)}};
 $("#confirm2fa").onsubmit=async e=>{e.preventDefault();try{await api("/auth/2fa/enable",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});toast("Two-factor authentication enabled. Sign in again to verify it.");currentUser.totp_enabled=1;security(v)}catch(err){toast(err.message)}};
}
document.addEventListener("visibilitychange",()=>{if(document.hidden&&window.chatTimer){clearInterval(window.chatTimer);window.chatTimer=null}});
init();
