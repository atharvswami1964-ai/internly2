const $ = id => document.getElementById(id);

const read = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

let users = read("internlyUsers");
let jobs = read("internlyJobs");
let applications = read("internlyApplications");
let saved = read("internlySaved", {});
let currentUser = read("internlySession", null);
let authMode = "login";
let currentView = "dashboard";
let toastTimer;

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2500);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

const today = (add = 0) => {
  const d = new Date(); d.setDate(d.getDate() + add);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const isOpen = j => !j.closed && (!j.deadline || j.deadline >= today());
const mySaved = () => saved[currentUser?.email] || [];

// Authentication
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("loginTab").classList.toggle("active", !signup);
  $("signupTab").classList.toggle("active", signup);
  $("authTitle").textContent = signup ? "Create Account" : "Welcome Back!";
  $("authSubtitle").textContent = signup
    ? "Create your student or provider account."
    : "Login to access your dashboard.";
  $("nameField").classList.toggle("hidden", !signup);
  $("companyField").classList.toggle("hidden", !signup || $("role").value !== "provider");
  $("roleField").classList.toggle("hidden", !signup);
  $("name").required = signup;
  $("company").required = false;
  $("authSubmit").textContent = signup ? "Create Account →" : "Login →";
  $("authError").textContent = "";
}
$("loginTab").onclick = () => setAuthMode("login");
$("signupTab").onclick = () => setAuthMode("signup");
$("role").onchange = () => setAuthMode(authMode);

$("authForm").addEventListener("submit", event => {
  event.preventDefault();

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;

  if (authMode === "signup") {
    const name = $("name").value.trim();
    const role = $("role").value;
    const company = $("company").value.trim();

    if (role === "provider" && !company) {
      $("authError").textContent = "Please enter your company name.";
      return;
    }
    if (users.some(u => u.email === email)) {
      $("authError").textContent = "This email is already registered. Please log in.";
      return;
    }

    const user = {
      id: Date.now(),
      name, email, password, role,
      company: role === "provider" ? company : "",
      phone: "", college: "", skills: "", bio: ""
    };
    users.push(user);
    write("internlyUsers", users);
    login(user);
    toast("Account created successfully!");
  } else {
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      $("authError").textContent = "Invalid login details. Check your email and password.";
      return;
    }
    login(user);
    toast("Welcome back, " + user.name + "!");
  }
});

function loadDemo() {
  if (!users.some(u => u.email === "provider@demo.com")) {
    users.push(
      {id: 1, name: "Demo Provider", email: "provider@demo.com", password: "demo123", role: "provider", company: "TechNova Labs", phone: "", college: "", skills: "", bio: "We build developer tools."},
      {id: 2, name: "Demo Student", email: "student@demo.com", password: "demo123", role: "student", company: "", phone: "", college: "GCEK Karad", skills: "HTML, CSS, JavaScript", bio: ""}
    );
    const mk = (id, title, description, type, duration, stipend, d) => ({id, providerEmail: "provider@demo.com", company: "TechNova Labs", title, description, type, duration, stipend, deadline: today(d), closed: false});
    jobs.push(
      mk(101, "Web Developer Intern", "Build responsive pages with HTML, CSS and JavaScript.", "Remote", "3 months", "₹8,000", 20),
      mk(102, "Data Analyst Intern", "Clean datasets and build dashboards using Python and SQL.", "Hybrid", "2 months", "₹6,000", 10),
      mk(103, "UI/UX Design Intern", "Design mobile app screens in Figma.", "On-site", "6 months", "Unpaid", 30)
    );
    write("internlyUsers", users); write("internlyJobs", jobs);
  }
  setAuthMode("login");
  $("email").value = "student@demo.com";
  $("password").value = "demo123";
  toast("Demo ready. Student: student@demo.com, Provider: provider@demo.com (password demo123)");
}

function login(user) {
  currentUser = {id: user.id, email: user.email, role: user.role};
  write("internlySession", currentUser);
  $("authPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");
  renderShell();
  showView("dashboard");
}

function logout() {
  currentUser = null;
  localStorage.removeItem("internlySession");
  $("appPage").classList.add("hidden");
  $("authPage").classList.remove("hidden");
  $("password").value = "";
  $("authForm").reset();
  setAuthMode("login");
  toast("Logged out successfully.");
}

function getUser() {
  return users.find(u => u.email === currentUser?.email);
}
function getMyJobs() {
  return jobs.filter(j => j.providerEmail === currentUser?.email);
}
function getMyApplications() {
  return applications.filter(a => a.studentEmail === currentUser?.email);
}

// Role-specific navigation
function renderShell() {
  const user = getUser();
  if (!user) return logout();

  $("sideName").textContent = user.name;
  $("sideRole").textContent = user.role === "student" ? "Student" : "Internship Provider";
  $("avatar").textContent = user.name.charAt(0).toUpperCase();
  $("headerAvatar").textContent = user.name.charAt(0).toUpperCase();

  const menu = user.role === "student"
    ? [
        ["dashboard", "▦ Dashboard"],
        ["browse", "⌕ Browse Internships"],
        ["saved", "★ Saved"],
        ["applications", "▤ My Applications"],
        ["profile", "♙ My Profile"]
      ]
    : [
        ["dashboard", "▦ Dashboard"],
        ["manage", "▤ Manage Internships"],
        ["applicants", "♙ Student Applications"],
        ["profile", "♙ Company Profile"]
      ];

  $("sideMenu").innerHTML = menu.map(([view, label]) =>
    `<button class="menu-item" data-view="${view}">${label}</button>`
  ).join("");

  $("sideMenu").querySelectorAll("[data-view]").forEach(button => {
    button.onclick = () => showView(button.dataset.view);
  });
}

function showView(view) {
  const user = getUser();
  if (!user) return logout();

  const studentViews = ["dashboard", "browse", "saved", "applications", "profile"];
  const providerViews = ["dashboard", "manage", "applicants", "profile"];
  const allowed = user.role === "student" ? studentViews : providerViews;

  if (!allowed.includes(view)) {
    toast("You do not have access to this page.");
    return;
  }

  currentView = view;
  $("sideMenu").querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    dashboard: "Dashboard",
    browse: "Browse Internships",
    saved: "Saved Internships",
    applications: "My Applications",
    manage: "Manage Internships",
    applicants: "Student Applications",
    profile: user.role === "student" ? "My Profile" : "Company Profile"
  };

  $("pageTitle").textContent = titles[view];
  $("pageSubtitle").textContent = user.role === "student"
    ? "Manage your career journey and applications."
    : "Manage your company opportunities and applicants.";

  const content = $("dashboardContent");
  content.innerHTML = "";

  if (view === "dashboard") renderDashboard(content, user);
  if (view === "browse") renderBrowse(content);
  if (view === "saved") renderBrowse(content, true);
  if (view === "applications") renderStudentApplications(content);
  if (view === "manage") renderManageJobs(content);
  if (view === "applicants") renderApplicants(content);
  if (view === "profile") renderProfile(content, user);
}

function statCard(label, value, detail = "") {
  return `<div class="stat-card">
    <small>${escapeHTML(label)}</small>
    <h2>${escapeHTML(value)}</h2>
    <p>${escapeHTML(detail)}</p>
  </div>`;
}

function panel(title, body, button = "") {
  return `<section class="panel">
    <div class="panel-heading"><h2>${title}</h2>${button}</div>${body}
  </section>`;
}

function renderDashboard(content, user) {
  if (user.role === "student") {
    const mine = getMyApplications();
    const openJobs = jobs.filter(isOpen);
    const selected = mine.filter(a => a.status === "Selected").length;

    content.innerHTML = `
      <div class="stats-grid">
        ${statCard("Available Internships", String(openJobs.length), "Explore opportunities")}
        ${statCard("Applications Sent", String(mine.length), "Your submitted applications")}
        ${statCard("Selected", String(selected), "Successful applications")}
      </div>
      ${panel("Recent Applications", studentApplicationTable(mine.slice(-5).reverse()))}
      ${panel("Quick Actions", `
        <button class="btn primary" onclick="showView('browse')">Browse Internships →</button>
        <button class="table-btn" onclick="showView('profile')">Update My Profile</button>
      `)}
    `;
  } else {
    const mine = getMyJobs();
    const received = applications.filter(a => mine.some(j => j.id === a.jobId));
    const pending = received.filter(a => a.status === "Under Review").length;

    content.innerHTML = `
      <div class="stats-grid">
        ${statCard("Published Internships", String(mine.length), "Your active listings")}
        ${statCard("Total Applicants", String(received.length), "Applications received")}
        ${statCard("Under Review", String(pending), "Awaiting a decision")}
      </div>
      ${panel("Your Recent Listings", providerJobTable(mine.slice(-5).reverse()))}
      ${panel("Quick Actions", `
        <button class="btn primary" onclick="openJobModal()">+ Publish Internship</button>
        <button class="table-btn" onclick="showView('applicants')">View Applicants</button>
      `)}
    `;
  }
}

// Student internship browser
function jobCard(j) {
  const applied = applications.some(a => a.jobId === j.id && a.studentEmail === currentUser.email);
  const star = mySaved().includes(j.id);
  return `<article class="job-card">
    <div class="card-top">
      <h3>${escapeHTML(j.title)}</h3>
      <button class="star ${star ? "on" : ""}" title="Save internship" onclick="toggleSave(${j.id}, this)">${star ? "★" : "☆"}</button>
    </div>
    <strong>${escapeHTML(j.company)}</strong>
    <p>${escapeHTML(j.description)}</p>
    <div class="job-meta">
      <span>${escapeHTML(j.type)}</span>
      <span>${escapeHTML(j.duration)}</span>
      <span>${escapeHTML(j.stipend)}</span>
    </div>
    <p>Deadline: ${escapeHTML(j.deadline || "Not specified")}</p>
    <button class="btn ${applied ? "" : "primary"}" ${applied ? "disabled" : ""}
      onclick="applyJob(${j.id})">${applied ? "Applied ✓" : "Apply Now →"}</button>
  </article>`;
}

function toggleSave(id, btn) {
  const list = mySaved();
  saved[currentUser.email] = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  write("internlySaved", saved);
  if (currentView === "saved") return showView("saved");
  const on = saved[currentUser.email].includes(id);
  btn.textContent = on ? "★" : "☆";
  btn.classList.toggle("on", on);
}

function renderBrowse(content, savedOnly = false) {
  content.innerHTML = `
    <section class="panel">
      <div class="panel-heading"><h2>${savedOnly ? "Your saved internships" : "Find your next opportunity"}</h2></div>
      <div class="filter-bar">
        <input id="jobSearch" placeholder="Search by title, company, or skills...">
        <select id="jobFilter"><option value="">All types</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select>
        <select id="jobSort"><option value="new">Newest first</option><option value="deadline">Deadline soonest</option></select>
      </div>
    </section>
    <div class="job-grid" id="browseGrid"></div>`;

  function draw() {
    const q = $("jobSearch").value.toLowerCase(), type = $("jobFilter").value, sort = $("jobSort").value;
    const list = jobs
      .filter(j => isOpen(j) && (!savedOnly || mySaved().includes(j.id)) && (!type || j.type === type)
        && `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q))
      .sort((a, b) => sort === "deadline"
        ? (a.deadline || "9999").localeCompare(b.deadline || "9999") : b.id - a.id);
    $("browseGrid").innerHTML = list.length ? list.map(jobCard).join("")
      : `<div class="empty-state">${savedOnly ? "No saved internships yet." : "No internships found."}</div>`;
  }
  [$("jobSearch"), $("jobFilter"), $("jobSort")].forEach(el => el.addEventListener("input", draw));
  draw();
}

let applyingJob = null;
function applyJob(jobId) {
  const job = jobs.find(j => j.id === jobId);
  if (!job || getUser()?.role !== "student") return;
  if (!isOpen(job)) return toast("This internship is closed.");
  if (applications.some(a => a.jobId === jobId && a.studentEmail === currentUser.email)) {
    return toast("You have already applied.");
  }
  applyingJob = job;
  $("applyForm").reset();
  $("applyTitle").textContent = "Apply: " + job.title;
  $("applyModal").classList.remove("hidden");
}
function closeApplyModal() {
  $("applyModal").classList.add("hidden");
  applyingJob = null;
}
$("applyForm").addEventListener("submit", event => {
  event.preventDefault();
  const job = applyingJob;
  if (!job) return;
  applications.push({
    id: Date.now(),
    jobId: job.id,
    title: job.title,
    company: job.company,
    studentEmail: currentUser.email,
    status: "Under Review",
    appliedAt: new Date().toLocaleDateString(),
    note: $("applyNote").value.trim(),
    link: $("applyLink").value.trim()
  });
  write("internlyApplications", applications);
  closeApplyModal();
  toast("Application submitted successfully!");
  showView(currentView);
});

function studentApplicationTable(list) {
  if (!list.length) return '<div class="empty-state">No applications yet. Browse internships to get started.</div>';

  return `<table><thead><tr><th>Internship</th><th>Company</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${list.map(a => `<tr>
      <td>${escapeHTML(a.title)}</td>
      <td>${escapeHTML(a.company)}</td>
      <td>${escapeHTML(a.appliedAt)}</td>
      <td><span class="status ${escapeHTML(a.status)}">${escapeHTML(a.status)}</span></td>
      <td>${a.status === "Under Review"
        ? `<button class="table-btn danger" onclick="withdrawApplication(${a.id})">Withdraw</button>` : "—"}</td>
    </tr>`).join("")}</tbody></table>`;
}

function withdrawApplication(id) {
  const a = applications.find(x => x.id === id);
  if (!a || a.studentEmail !== currentUser.email || a.status !== "Under Review") return;
  if (!confirm("Withdraw this application?")) return;
  applications = applications.filter(x => x.id !== id);
  write("internlyApplications", applications);
  toast("Application withdrawn.");
  showView(currentView);
}

function renderStudentApplications(content) {
  content.innerHTML = panel("Track Your Applications", studentApplicationTable(getMyApplications().slice().reverse()));
}

// Provider listing management
let editingJobId = null;
function openJobModal(id) {
  if (getUser()?.role !== "provider") return;
  const job = id ? jobs.find(j => j.id === id && j.providerEmail === currentUser.email) : null;
  editingJobId = job ? job.id : null;
  $("jobForm").reset();
  $("jobDeadline").min = today();
  $("jobModalTitle").textContent = job ? "Edit Internship" : "Publish Internship";
  $("jobSubmit").textContent = job ? "Save Changes" : "Publish Internship";
  if (job) {
    $("jobTitle").value = job.title;
    $("jobDescription").value = job.description;
    $("jobType").value = job.type;
    $("jobDuration").value = job.duration;
    $("jobStipend").value = job.stipend;
    $("jobDeadline").value = job.deadline || "";
  }
  $("jobModal").classList.remove("hidden");
}
function closeJobModal() {
  $("jobModal").classList.add("hidden");
}

$("jobForm").addEventListener("submit", event => {
  event.preventDefault();
  const user = getUser();
  if (user?.role !== "provider") return;

  const old = jobs.find(j => j.id === editingJobId && j.providerEmail === user.email);
  const deadline = $("jobDeadline").value;
  if (deadline && deadline < today() && deadline !== old?.deadline) {
    toast("Please select a future deadline.");
    return;
  }

  const data = {
    title: $("jobTitle").value.trim(),
    description: $("jobDescription").value.trim(),
    type: $("jobType").value,
    duration: $("jobDuration").value.trim(),
    stipend: $("jobStipend").value.trim(),
    deadline
  };
  const company = user.company || user.name;

  if (old) Object.assign(old, data, {company});
  else jobs.push({id: Date.now(), providerEmail: user.email, company, closed: false, ...data});

  write("internlyJobs", jobs);
  closeJobModal();
  toast(old ? "Internship updated." : "Internship published successfully!");
  showView("manage");
});

function jobState(j) {
  return j.closed ? "Closed" : (j.deadline && j.deadline < today() ? "Expired" : "Open");
}

function toggleJob(id) {
  const job = jobs.find(j => j.id === id && j.providerEmail === currentUser.email);
  if (!job) return;
  job.closed = !job.closed;
  write("internlyJobs", jobs);
  toast(job.closed ? "Internship closed." : "Internship reopened.");
  showView(currentView);
}

function providerJobTable(list) {
  if (!list.length) return '<div class="empty-state">No internships published yet. Publish your first internship.</div>';

  return `<table><thead><tr><th>Internship</th><th>Type</th><th>Applicants</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${list.map(j => { const st = jobState(j); return `<tr>
      <td>${escapeHTML(j.title)}</td>
      <td>${escapeHTML(j.type)}</td>
      <td>${applications.filter(a => a.jobId === j.id).length}</td>
      <td>${escapeHTML(j.deadline || "Not specified")}</td>
      <td><span class="status ${st}">${st}</span></td>
      <td>
        <button class="table-btn" onclick="openJobModal(${j.id})">Edit</button>
        <button class="table-btn" onclick="toggleJob(${j.id})">${j.closed ? "Reopen" : "Close"}</button>
        <button class="table-btn danger" onclick="deleteJob(${j.id})">Delete</button>
      </td>
    </tr>`; }).join("")}</tbody></table>`;
}

function renderManageJobs(content) {
  content.innerHTML = panel("Your Published Internships",
    providerJobTable(getMyJobs().slice().reverse()),
    '<button class="btn primary" onclick="openJobModal()">+ Publish</button>');
}

function deleteJob(id) {
  const job = jobs.find(j => j.id === id);
  if (!job || job.providerEmail !== currentUser.email) return;
  if (!confirm("Delete this internship and its applications?")) return;

  jobs = jobs.filter(j => j.id !== id);
  applications = applications.filter(a => a.jobId !== id);
  write("internlyJobs", jobs);
  write("internlyApplications", applications);
  toast("Internship deleted.");
  showView(currentView);
}

const STATUSES = ["Under Review", "Shortlisted", "Selected", "Rejected"];

function renderApplicants(content) {
  const mine = getMyJobs();
  const received = applications.filter(a => mine.some(j => j.id === a.jobId)).reverse();

  if (!received.length) {
    content.innerHTML = panel("Student Applications",
      '<div class="empty-state">No students have applied to your internships yet.</div>');
    return;
  }

  content.innerHTML = panel("Manage Student Applications", `
    <div class="filter-bar">
      <select id="appJob"><option value="">All internships</option>
        ${mine.map(j => `<option value="${j.id}">${escapeHTML(j.title)}</option>`).join("")}</select>
      <select id="appStatus"><option value="">All statuses</option>
        ${STATUSES.map(x => `<option>${x}</option>`).join("")}</select>
    </div>
    <div id="appTable"></div>`);

  function draw() {
    const jobId = $("appJob").value, status = $("appStatus").value;
    const list = received.filter(a => (!jobId || String(a.jobId) === jobId) && (!status || a.status === status));
    $("appTable").innerHTML = !list.length ? '<div class="empty-state">No applications match these filters.</div>' : `
      <table style="min-width:860px"><thead><tr><th>Student</th><th>College / Skills</th><th>Internship</th><th>Applied</th><th>Note</th><th>Status</th></tr></thead>
      <tbody>${list.map(a => {
        const st = users.find(u => u.email === a.studentEmail);
        const link = /^https?:\/\//i.test(a.link || "")
          ? `<p><a href="${escapeHTML(a.link)}" target="_blank" rel="noopener">Portfolio ↗</a></p>` : "";
        return `<tr>
          <td><strong>${escapeHTML(st?.name || "Student")}</strong><br>${escapeHTML(a.studentEmail)}<br>${escapeHTML(st?.phone || "")}</td>
          <td>${escapeHTML(st?.college || "—")}<br><small>${escapeHTML(st?.skills || "")}</small></td>
          <td>${escapeHTML(a.title)}</td>
          <td>${escapeHTML(a.appliedAt)}</td>
          <td>${a.note ? `<details><summary>View</summary><p>${escapeHTML(a.note)}</p></details>` : "—"}${link}</td>
          <td><select onchange="updateStatus(${a.id},this.value)">
            ${STATUSES.map(x => `<option ${a.status === x ? "selected" : ""}>${x}</option>`).join("")}
          </select></td>
        </tr>`;
      }).join("")}</tbody></table>`;
  }
  $("appJob").oninput = $("appStatus").oninput = draw;
  draw();
}

function updateStatus(applicationId, status) {
  const application = applications.find(a => a.id === applicationId);
  if (!application) return;

  const job = jobs.find(j => j.id === application.jobId);
  if (!job || job.providerEmail !== currentUser.email) {
    toast("You cannot update this application.");
    return;
  }

  application.status = status;
  write("internlyApplications", applications);
  toast("Application status updated.");
}

// Profile information
function renderProfile(content, user) {
  const provider = user.role === "provider";

  content.innerHTML = panel(provider ? "Company Profile" : "Student Profile", `
    <form id="profileForm" class="profile-form">
      <label>${provider ? "Contact name" : "Full name"}</label>
      <input id="profileName" value="${escapeHTML(user.name)}" required>
      ${provider ? `
        <label>Company name</label>
        <input id="profileCompany" value="${escapeHTML(user.company || "")}" required>
      ` : `
        <label>College / University</label>
        <input id="profileCollege" value="${escapeHTML(user.college || "")}">
        <label>Skills</label>
        <input id="profileSkills" value="${escapeHTML(user.skills || "")}" placeholder="HTML, CSS, JavaScript">
      `}
      <label>Email address</label>
      <input value="${escapeHTML(user.email)}" disabled>
      <label>Phone number</label>
      <input id="profilePhone" value="${escapeHTML(user.phone || "")}">
      <label>About ${provider ? "company" : "yourself"}</label>
      <textarea id="profileBio">${escapeHTML(user.bio || "")}</textarea>
      <label>New password (leave blank to keep current)</label>
      <input id="profilePass" type="password" minlength="6" autocomplete="new-password">
      <button class="btn primary">Save Profile</button>
    </form>
  `);

  $("profileForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("profileName").value.trim();
    if (!name) return;

    user.name = name;
    user.phone = $("profilePhone").value.trim();
    user.bio = $("profileBio").value.trim();
    const pw = $("profilePass").value;
    if (pw) user.password = pw;

    if (provider) {
      user.company = $("profileCompany").value.trim();
      jobs.filter(j => j.providerEmail === user.email)
        .forEach(j => j.company = user.company);
      write("internlyJobs", jobs);
    } else {
      user.college = $("profileCollege").value.trim();
      user.skills = $("profileSkills").value.trim();
    }

    write("internlyUsers", users);
    renderShell();
    toast("Profile updated successfully.");
    showView("profile");
  });
}

// Close modals with Escape or by clicking the backdrop.
function closeModals() { closeJobModal(); closeApplyModal(); }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });
document.querySelectorAll(".modal-overlay").forEach(o =>
  o.addEventListener("mousedown", e => { if (e.target === o) closeModals(); }));

// Restore a previous browser session.
if (currentUser && getUser()) {
  $("authPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");
  renderShell();
  showView("dashboard");
} else {
  currentUser = null;
  localStorage.removeItem("internlySession");
  setAuthMode("login");
}