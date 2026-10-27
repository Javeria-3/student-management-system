const studentRows = document.getElementById("student-rows");
const searchInput = document.getElementById("student-search");
const statusFilter = document.getElementById("status-filter");
const yearFilter = document.getElementById("year-filter");
const departmentFilter = document.getElementById("department-filter");
const modal = document.getElementById("student-modal");
const studentForm = document.getElementById("student-form");
const profileModal = document.getElementById("profile-modal");
const formError = document.getElementById("form-error");
const saveButton = document.getElementById("save-student");
const toastRegion = document.getElementById("toast-region");

let editingStudentId = null;
let profileStudentId = null;
let currentProfileStudent = null;
let activeProfileTab = "overview";
let students = [];
let searchTimer;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function renderProfileHeader(student) {
  const statusClass = {
    Active: "badge-active",
    "On leave": "badge-leave",
    Graduated: "badge-graduated",
  }[student.status] || "badge-active";
  document.getElementById("profile-heading").innerHTML = `
    <div class="profile-hero">
      <span class="profile-avatar">${escapeHtml(initials(student))}</span>
      <div class="profile-name-group">
        <span class="profile-institution-label">NORTHFIELD UNIVERSITY <span>·</span> STUDENT PROFILE</span>
        <h2 id="profile-title">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</h2>
        <p id="profile-summary">${escapeHtml(student.program)} <span>·</span> Year ${student.yearOfStudy} <span>·</span> ${escapeHtml(student.studentId)}</p>
        <span class="status-badge ${statusClass}"><span></span>${escapeHtml(student.status)}</span>
      </div>
      <div class="profile-enrollment-badge"><span>REGISTERED STUDENT</span><strong>${escapeHtml(student.studentId)}</strong><span>Northfield Campus</span></div>
    </div>`;
}

function renderProfileTab(student, tab = activeProfileTab) {
  const content = document.getElementById("profile-content");
  const registered = formatAdmissionDate(student.createdAt);

  if (tab === "academics") {
    content.innerHTML = `
      <div class="profile-section-heading"><span class="profile-section-eyebrow">KEEPING THE MOMENTUM</span><h3>Academic progress</h3><p>A clear snapshot of ${escapeHtml(student.firstName)}’s university journey.</p></div>
      <div class="profile-stat-grid">
        <article class="profile-stat-card"><span>Current GPA</span><strong>${Number(student.gpa).toFixed(2)}<small> / 4.0</small></strong><span class="profile-metric-icon gpa-metric">✦</span></article>
        <article class="profile-stat-card"><span>Current study year</span><strong>Year ${student.yearOfStudy}<small> of 6</small></strong><span class="profile-metric-icon year-metric"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></svg></span></article>
      </div>
      <article class="profile-detail-card"><div class="profile-card-title"><span class="profile-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1m-6 4h1m4 0h1"/></svg></span><span><strong>Program & department</strong><small>Student's academic home</small></span></div><div class="profile-detail-grid"><div><span>Academic program</span><strong>${escapeHtml(student.program)}</strong></div><div><span>Department</span><strong>${escapeHtml(student.department)}</strong></div><div><span>Year of study</span><strong>Year ${student.yearOfStudy}</strong></div><div><span>Current academic standing</span><strong>${escapeHtml(student.status)}</strong></div></div></article>
      <div class="profile-note"><span class="profile-note-icon">✦</span><span><strong>Academic results, kept together.</strong> The GPA shown above is the current overall average on file. Class-by-class assessments and printable report cards can be added as academic grading features are introduced.</span></div>`;
  } else if (tab === "family") {
    const hasFamily = student.guardianName || student.guardianEmail || student.guardianPhone;
    content.innerHTML = `
      <div class="profile-section-heading"><span class="profile-section-eyebrow">THE PEOPLE IN THEIR CORNER</span><h3>Family & trusted contacts</h3><p>Keep a student's trusted family contact alongside their own university details.</p></div>
      <div class="family-card">
        <div class="profile-card-title"><span class="profile-card-icon family-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2.5 20v-1.6A5.4 5.4 0 0 1 7.9 13h2.2a5.4 5.4 0 0 1 5.4 5.4V20m.8-12h6m-3-3v6"/></svg></span><span><strong>Parent or guardian</strong><small>Family contact on record</small></span></div>
        ${hasFamily ? `<div class="family-contact"><span class="family-avatar">${escapeHtml(initials({ firstName: student.guardianName?.split(" ")[0] || "N", lastName: student.guardianName?.split(" ").slice(1).join(" ") || "A" }))}</span><div class="family-name"><strong>${escapeHtml(student.guardianName || "Family contact")}</strong><span>${escapeHtml(student.guardianRelationship || "Trusted contact")}</span></div>${student.guardianPhone ? `<a class="family-contact-link" href="tel:${escapeHtml(student.guardianPhone)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.4 19.4 0 0 1 5.7 11 19.8 19.8 0 0 1 2.6 2.4 2 2 0 0 1 4.6.2h3a2 2 0 0 1 2 1.7l.5 3.2a2 2 0 0 1-.6 1.7L8.2 8.1a16 16 0 0 0 7.7 7.7l1.3-1.3a2 2 0 0 1 1.7-.6l3.2.5a2 2 0 0 1 1.9 2.5Z"/></svg>${escapeHtml(student.guardianPhone)}</a>` : ""}${student.guardianEmail ? `<a class="family-contact-link" href="mailto:${escapeHtml(student.guardianEmail)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>${escapeHtml(student.guardianEmail)}</a>` : ""}</div>` : `<div class="profile-empty-state"><span class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2.5 20v-1.6A5.4 5.4 0 0 1 7.9 13h2.2a5.4 5.4 0 0 1 5.4 5.4V20m.8-12h6"/></svg></span><strong>No family contact on file just yet.</strong><span>When a trusted contact is added, their details will be thoughtfully kept here.</span></div>`}
      </div>
      <article class="profile-detail-card"><div class="profile-card-title"><span class="profile-card-icon student-contact-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 9h8m-8 4h8m-8 4h5"/></svg></span><span><strong>Student contact details</strong><small>Contact the student directly</small></span></div><div class="profile-detail-grid"><div><span>University email</span><strong>${student.email ? `<a href="mailto:${escapeHtml(student.email)}">${escapeHtml(student.email)}</a>` : "Not on file"}</strong></div><div><span>Student phone</span><strong>${student.phone ? `<a href="tel:${escapeHtml(student.phone)}">${escapeHtml(student.phone)}</a>` : "Not on file"}</strong></div><div class="profile-full-width"><span>Home address</span><strong>${escapeHtml(student.address || "No home address on file")}</strong></div></div></article>`;
  } else if (tab === "records") {
    content.innerHTML = `
      <div class="profile-section-heading"><span class="profile-section-eyebrow">ALL THE LITTLE DETAILS THAT MATTER</span><h3>Attendance & student records</h3><p>One place to keep the whole student journey connected, from admission to graduation.</p></div>
      <article class="profile-lifecycle-card"><div class="lifecycle-number">01</div><div class="lifecycle-line"><span></span></div><span class="lifecycle-main-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h8"/><path d="m15 17 2 2 4-5"/></svg></span><div class="lifecycle-copy"><span>STUDENT JOURNEY</span><strong>University enrollment</strong><small>${escapeHtml(registered)} · Northfield Campus</small></div><span class="lifecycle-badge">ON FILE</span></article>
      <div class="profile-section-heading profile-records-heading"><span class="profile-section-eyebrow">YOUR 360° STUDENT RECORD</span><h3>Every record, accounted for</h3></div>
      <div class="profile-records-grid">
        <article class="record-status-card"><span class="record-icon record-attendance"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17m4 4 2 2 4-4"/></svg></span><span><strong>Attendance</strong><small>Daily attendance tracking</small></span><span class="record-not-recorded">Not recorded yet</span></article>
        <article class="record-status-card"><span class="record-icon record-grades"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg></span><span><strong>Academic average</strong><small>Overall GPA on file</small></span><span class="record-available">${Number(student.gpa).toFixed(2)} GPA</span></article>
        <article class="record-status-card"><span class="record-icon record-fees"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/></svg></span><span><strong>Fee ledger</strong><small>Fee payments & balances</small></span><span class="record-not-recorded">Not recorded yet</span></article>
        <article class="record-status-card"><span class="record-icon record-documents"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z"/><path d="M13 3v7h7"/></svg></span><span><strong>Student documents</strong><small>Forms & identity records</small></span><span class="record-not-recorded">Not recorded yet</span></article>
      </div>
      <div class="profile-note"><span class="profile-note-icon">✦</span><span><strong>Nothing is made up.</strong> Records are only shown when they've actually been added. Attendance, fee and document tracking are next on Northfield's roadmap.</span></div>`;
  } else {
    content.innerHTML = `
      <div class="profile-section-heading"><span class="profile-section-eyebrow">ONE PERSON, A WHOLE STORY</span><h3>A complete student picture</h3><p>Student record, academic context and the right people, together in one place.</p></div>
      <div class="profile-stat-grid">
        <article class="profile-stat-card"><span>Enrollment status</span><strong class="profile-enrollment-value">${escapeHtml(student.status)}</strong><span class="profile-metric-icon active-metric"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span></article>
        <article class="profile-stat-card"><span>Study year</span><strong>Year ${student.yearOfStudy}<small> of 6</small></strong><span class="profile-metric-icon year-metric"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></svg></span></article>
        <article class="profile-stat-card"><span>Overall academic average</span><strong>${Number(student.gpa).toFixed(2)}<small> / 4.0 GPA</small></strong><span class="profile-metric-icon gpa-metric">✦</span></article>
        <article class="profile-stat-card"><span>University registration</span><strong class="profile-registration-value">${escapeHtml(registered.replace("Registered ", ""))}</strong><span class="profile-metric-icon admission-metric"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4l2.5 2m5.5-2a8 8 0 1 1-8-8 8 8 0 0 1 8 8Z"/></svg></span></article>
      </div>
      <div class="profile-two-columns"><article class="profile-detail-card"><div class="profile-card-title"><span class="profile-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1m-6 4h1m4 0h1"/></svg></span><span><strong>Academic home</strong><small>Department & degree</small></span></div><div class="profile-detail-grid"><div><span>Program</span><strong>${escapeHtml(student.program)}</strong></div><div><span>Department</span><strong>${escapeHtml(student.department)}</strong></div></div></article>
      <article class="profile-detail-card"><div class="profile-card-title"><span class="profile-card-icon family-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2.5 20v-1.6A5.4 5.4 0 0 1 7.9 13h2.2a5.4 5.4 0 0 1 5.4 5.4V20m.8-12h6m-3-3v6"/></svg></span><span><strong>Family connection</strong><small>Parent or trusted guardian</small></span></div><div class="family-mini-summary"><span class="family-avatar">${student.guardianName ? escapeHtml(initials({ firstName: student.guardianName.split(" ")[0] || "", lastName: student.guardianName.split(" ").slice(1).join(" ") })) : "—"}</span><span><strong>${escapeHtml(student.guardianName || "Add a family contact")}</strong><small>${escapeHtml(student.guardianRelationship || (student.guardianName ? "Family contact" : "Keep a trusted adult in the loop"))}</small></span><button type="button" class="profile-inline-link" data-switch-profile-tab="family">Details <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></div></article></div>
      <div class="profile-detail-card profile-admission-strip"><span class="profile-admission-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h8"/><path d="m15 17 2 2 4-5"/></svg></span><span><span class="profile-field-label">STUDENT SINCE</span><strong>${escapeHtml(registered)}</strong></span><span class="profile-admission-divider"></span><span><span class="profile-field-label">UNIVERSITY ID</span><strong>${escapeHtml(student.studentId)}</strong></span></div>`;
  }

  document.querySelectorAll(".profile-tab").forEach((button) => {
    const isActive = button.dataset.profileTab === tab;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

async function openProfile(studentId) {
  try {
    const result = await request(`/api/students/${encodeURIComponent(studentId)}`);
    profileStudentId = studentId;
    currentProfileStudent = result.student;
    activeProfileTab = "overview";
    renderProfileHeader(result.student);
    renderProfileTab(result.student);
    profileModal.hidden = false;
    document.body.classList.add("modal-open");
  } catch (error) {
    showToast(`Couldn't open this student profile: ${error.message}`, "error");
  }
}

function closeProfile() {
  profileModal.hidden = true;
  document.body.classList.toggle("modal-open", !modal.hidden);
  profileStudentId = null;
  currentProfileStudent = null;
}

function exportStudents() {
  const columns = [
    ["Student ID", "studentId"],
    ["First name", "firstName"],
    ["Last name", "lastName"],
    ["University email", "email"],
    ["Department", "department"],
    ["Program", "program"],
    ["Year of study", "yearOfStudy"],
    ["Status", "status"],
    ["GPA", "gpa"],
    ["Phone", "phone"],
    ["Parent or guardian", "guardianName"],
    ["Relationship", "guardianRelationship"],
    ["Family email", "guardianEmail"],
    ["Family phone", "guardianPhone"],
    ["Address", "address"],
  ];
  const csvField = (value) => {
    const text = String(value ?? "");
    const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const csv = [
    columns.map(([label]) => csvField(label)).join(","),
    ...students.map((student) => columns.map(([, field]) => csvField(student[field])).join(",")),
  ].join("\r\n");
  const file = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "northfield-student-register.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  showToast(`Your filtered student register is ready to download (${students.length} ${students.length === 1 ? "student" : "students"}).`);
}

function initials(student) {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

function renderStudent(student, index) {
  const name = `${student.firstName} ${student.lastName}`;
  const statusClass = {
    Active: "badge-active",
    "On leave": "badge-leave",
    Graduated: "badge-graduated",
  }[student.status] || "badge-active";

  return `
    <tr>
      <td><div class="student-person"><span class="student-avatar avatar-tone-${index % 5}">${escapeHtml(initials(student))}</span><span class="student-person-copy"><button type="button" class="student-profile-link" data-student-id="${escapeHtml(student.studentId)}">${escapeHtml(name)}</button><span>${escapeHtml(student.email)}</span></span></div></td>
      <td><span class="student-id">${escapeHtml(student.studentId)}</span></td>
      <td><div class="program-cell"><strong>${escapeHtml(student.department)}</strong><span>${escapeHtml(student.program)}</span></div></td>
      <td><span class="year-badge">Year ${escapeHtml(student.yearOfStudy)}</span></td>
      <td><span class="gpa-cell">${Number(student.gpa).toFixed(2)}<span> / 4.0</span></span></td>
      <td><span class="status-badge ${statusClass}"><span></span>${escapeHtml(student.status)}</span></td>
      <td class="action-cell">
        <details class="action-menu">
          <summary class="icon-button row-menu-button" aria-label="Actions for ${escapeHtml(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></summary>
          <div class="action-popover">
            <button type="button" class="view-student" data-student-id="${escapeHtml(student.studentId)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>Open 360° profile</button>
            <button type="button" class="edit-student" data-student-id="${escapeHtml(student.studentId)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>Edit record</button>
            <span class="popover-divider"></span>
            <button type="button" class="delete-student delete-action" data-student-id="${escapeHtml(student.studentId)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v7m4-7v7"/></svg>Remove student</button>
          </div>
        </details>
      </td>
    </tr>`;
}

function renderStudents() {
  if (students.length === 0) {
    studentRows.innerHTML = `
      <tr><td class="table-message" colspan="7">
        <div class="empty-state"><span class="empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2.5 20v-1.6A5.4 5.4 0 0 1 7.9 13h2.2a5.4 5.4 0 0 1 5.4 5.4V20m.8-12h6m-3-3v6"/></svg></span>
          <strong>No students found</strong><span>Try a different search, or add someone new to the community.</span>
          <button class="text-button" type="button" id="empty-add-student">Add a student <span aria-hidden="true">→</span></button>
        </div>
      </td></tr>`;
    document.getElementById("empty-add-student").addEventListener("click", openCreateModal);
  } else {
    studentRows.innerHTML = students.map(renderStudent).join("");
  }

  const count = students.length;
  document.getElementById("result-count").textContent = `${count} ${count === 1 ? "student" : "students"}`;
  document.getElementById("table-summary").textContent = `${count} ${count === 1 ? "record" : "records"} shown`;
  studentRows.querySelectorAll(".edit-student").forEach((button) => {
    button.addEventListener("click", () => openEditModal(button.dataset.studentId));
  });
  studentRows.querySelectorAll(".view-student").forEach((button) => {
    button.addEventListener("click", () => openProfile(button.dataset.studentId));
  });
  studentRows.querySelectorAll(".student-profile-link").forEach((button) => {
    button.addEventListener("click", () => openProfile(button.dataset.studentId));
  });
  studentRows.querySelectorAll(".delete-student").forEach((button) => {
    button.addEventListener("click", () => removeStudent(button.dataset.studentId));
  });
}

async function loadStudents() {
  const query = new URLSearchParams();
  if (searchInput.value.trim()) query.set("search", searchInput.value.trim());
  if (statusFilter.value !== "All statuses") query.set("status", statusFilter.value);
  if (yearFilter.value) query.set("yearOfStudy", yearFilter.value);
  if (departmentFilter.value) query.set("department", departmentFilter.value);

  try {
    const result = await request(`/api/students?${query}`);
    students = result.students;
    renderStudents();
  } catch (error) {
    studentRows.innerHTML = `<tr><td class="table-message" colspan="7"><div class="load-error"><strong>Couldn't load the student directory.</strong><span>${escapeHtml(error.message)}</span><button class="secondary-button retry-button" id="retry-students" type="button">Try again</button></div></td></tr>`;
    document.getElementById("retry-students").addEventListener("click", loadStudents);
    document.getElementById("table-summary").textContent = "Student records are temporarily unavailable";
  }
}

function renderYearChart(years) {
  const maximum = Math.max(1, ...years.map((year) => year.students));
  document.getElementById("year-chart").innerHTML = Array.from({ length: 6 }, (_, index) => {
    const yearOfStudy = index + 1;
    const record = years.find((year) => Number(year.yearOfStudy) === yearOfStudy);
    const count = Number(record?.students || 0);
    const percentage = Math.round((count / maximum) * 100);
    return `
      <button class="year-chart-row" type="button" data-year-filter="${yearOfStudy}" aria-label="Show ${count} students in year ${yearOfStudy}">
        <span class="year-chart-label">Year ${yearOfStudy}</span>
        <span class="chart-bar-track"><span class="chart-bar-fill${count ? "" : " chart-bar-empty"}" style="--bar-width:${percentage}%"></span></span>
        <span class="year-chart-count">${count}</span>
      </button>`;
  }).join("");
}

function renderDepartmentChart(departments, total) {
  const chart = document.getElementById("department-chart");
  if (departments.length === 0) {
    chart.innerHTML = '<div class="chart-empty">Add a student to see your academic departments.</div>';
    return;
  }

  chart.innerHTML = departments.map(({ department, students: count }) => {
    const percentage = total ? Math.round((count / total) * 100) : 0;
    return `
      <button class="department-chart-row" type="button" data-department-filter="${escapeHtml(department)}" aria-label="Show ${count} ${count === 1 ? "student" : "students"} in ${escapeHtml(department)}">
        <span class="department-dot"></span>
        <span class="department-chart-copy"><strong>${escapeHtml(department)}</strong><span class="department-bar-track"><span style="--bar-width:${percentage}%"></span></span></span>
        <span class="department-chart-count">${count}</span>
      </button>`;
  }).join("");
}

function formatAdmissionDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  const ageInDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (!Number.isFinite(date.getTime())) return "Recently registered";
  if (ageInDays < 1) return "Registered today";
  if (ageInDays === 1) return "Registered yesterday";
  return `Registered ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}`;
}

function renderRecentRegistrations(records, recentAdmissions) {
  document.getElementById("recent-subtitle").textContent =
    `${recentAdmissions} ${recentAdmissions === 1 ? "new enrollment" : "new enrollments"} in the last 90 days`;
  const list = document.getElementById("recent-students");
  if (records.length === 0) {
    list.innerHTML = '<div class="recent-empty"><span class="recent-empty-icon">✦</span><strong>Your next great story starts here.</strong><span>When someone joins the university, their record will appear here.</span><button type="button" class="text-button" id="recent-add-student">Enroll your first student <span aria-hidden="true">→</span></button></div>';
    document.getElementById("recent-add-student").addEventListener("click", openCreateModal);
    return;
  }

  list.innerHTML = records.map((student, index) => `
    <button class="recent-student" type="button" data-student-id="${escapeHtml(student.studentId)}">
      <span class="student-avatar avatar-tone-${index % 5}">${escapeHtml(initials(student))}</span>
      <span class="recent-student-copy"><strong>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</strong><span>${escapeHtml(student.department)} <span class="recent-dot">·</span> Year ${student.yearOfStudy}</span></span>
      <span class="recent-student-date">${escapeHtml(formatAdmissionDate(student.createdAt))}</span>
      <svg class="recent-student-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>`).join("");
  list.querySelectorAll(".recent-student").forEach((button) => {
    button.addEventListener("click", () => openProfile(button.dataset.studentId));
  });
}

async function loadStats() {
  try {
    const dashboard = await request("/api/dashboard");
    const { stats } = dashboard;
    document.getElementById("stat-total").textContent = stats.total.toLocaleString();
    document.getElementById("stat-active").textContent = stats.active.toLocaleString();
    document.getElementById("stat-leave").textContent = stats.onLeave.toLocaleString();
    document.getElementById("stat-gpa").textContent = Number(stats.averageGpa).toFixed(2);
    document.getElementById("nav-count").textContent = stats.total > 99 ? "99+" : stats.total;
    document.getElementById("profile-module-count").textContent = `${stats.total} ${stats.total === 1 ? "record" : "records"}`;
    renderYearChart(dashboard.academicYears);
    renderDepartmentChart(dashboard.departments, stats.total);
    renderRecentRegistrations(dashboard.recentRegistrations, stats.recentAdmissions);
  } catch (error) {
    showToast(`Couldn't refresh the enrollment summary: ${error.message}`, "error");
  }
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = type === "error" ? "!" : "✓";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(icon, text);
  toastRegion.append(toast);
  window.setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 350);
  }, 3500);
}

function resetFormError() {
  formError.hidden = true;
  formError.textContent = "";
}

function openCreateModal() {
  editingStudentId = null;
  studentForm.reset();
  studentForm.elements.yearOfStudy.value = "1";
  studentForm.elements.status.value = "Active";
  studentForm.elements.gpa.value = "0";
  document.getElementById("modal-title").textContent = "Welcome to the campus.";
  document.getElementById("modal-description").textContent = "Add a student to keep their campus journey organized and supported.";
  document.getElementById("save-label").textContent = "Add student";
  resetFormError();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  studentForm.elements.firstName.focus();
}

function openEditModal(studentId) {
  const student = students.find((record) => record.studentId === studentId);
  if (!student) {
    showToast("That student record is no longer available. Refresh and try again.", "error");
    return;
  }

  editingStudentId = student.studentId;
  for (const [field, value] of Object.entries(student)) {
    if (studentForm.elements.namedItem(field)) studentForm.elements[field].value = String(value);
  }
  document.getElementById("modal-title").textContent = "A little update.";
  document.getElementById("modal-description").textContent = "Make changes to this student's record. Everything stays in sync.";
  document.getElementById("save-label").textContent = "Save changes";
  resetFormError();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  studentForm.elements.firstName.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function saveStudent(event) {
  event.preventDefault();
  resetFormError();
  saveButton.disabled = true;

  const formData = new FormData(studentForm);
  const payload = Object.fromEntries(formData.entries());
  payload.yearOfStudy = Number(payload.yearOfStudy);
  payload.gpa = Number(payload.gpa);

  try {
    const path = editingStudentId
      ? `/api/students/${encodeURIComponent(editingStudentId)}`
      : "/api/students";
    await request(path, {
      method: editingStudentId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    closeModal();
    await Promise.all([loadStudents(), loadStats()]);
    showToast(editingStudentId ? "Student record updated with care." : "A new student joined the directory.");
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    saveButton.disabled = false;
  }
}

async function removeStudent(studentId) {
  const student = students.find((record) => record.studentId === studentId);
  if (!student) {
    showToast("That student record is no longer available. Refresh and try again.", "error");
    return;
  }

  if (!window.confirm(`Remove ${student.firstName} ${student.lastName} from the student directory? This cannot be undone.`)) return;

  try {
    await request(`/api/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
    await Promise.all([loadStudents(), loadStats()]);
    showToast(`${student.firstName} ${student.lastName}'s record has been removed.`);
  } catch (error) {
    showToast(`Couldn't remove this student: ${error.message}`, "error");
  }
}

document.getElementById("add-student").addEventListener("click", openCreateModal);
document.getElementById("export-students").addEventListener("click", exportStudents);
document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("cancel-modal").addEventListener("click", closeModal);
studentForm.addEventListener("submit", saveStudent);
statusFilter.addEventListener("change", loadStudents);
yearFilter.addEventListener("change", loadStudents);
departmentFilter.addEventListener("change", loadStudents);
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadStudents, 180);
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.getElementById("close-profile").addEventListener("click", closeProfile);
profileModal.addEventListener("click", (event) => {
  if (event.target === profileModal) closeProfile();
});
document.querySelectorAll(".profile-tab").forEach((button) => {
  button.addEventListener("click", () => {
    if (!currentProfileStudent) return;
    activeProfileTab = button.dataset.profileTab;
    renderProfileTab(currentProfileStudent);
  });
});
document.getElementById("profile-content").addEventListener("click", (event) => {
  const button = event.target.closest("[data-switch-profile-tab]");
  if (!button || !currentProfileStudent) return;
  activeProfileTab = button.dataset.switchProfileTab;
  renderProfileTab(currentProfileStudent);
});
document.getElementById("edit-profile").addEventListener("click", () => {
  if (!profileStudentId) return;
  const student = students.find((record) => record.studentId === profileStudentId) || currentProfileStudent;
  const studentId = profileStudentId;
  closeProfile();
  if (student && studentId) openEditModal(studentId);
});
document.getElementById("year-chart").addEventListener("click", (event) => {
  const row = event.target.closest("[data-year-filter]");
  if (!row) return;
  yearFilter.value = row.dataset.yearFilter;
  document.getElementById("students").scrollIntoView({ behavior: "smooth", block: "start" });
  loadStudents();
});
document.getElementById("department-chart").addEventListener("click", (event) => {
  const row = event.target.closest("[data-department-filter]");
  if (!row) return;
  departmentFilter.value = row.dataset.departmentFilter;
  document.getElementById("students").scrollIntoView({ behavior: "smooth", block: "start" });
  loadStudents();
});
document.getElementById("clear-insights-filter").addEventListener("click", () => {
  yearFilter.value = "";
  departmentFilter.value = "";
  statusFilter.value = "All statuses";
  searchInput.value = "";
  document.getElementById("students").scrollIntoView({ behavior: "smooth", block: "start" });
  loadStudents();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".action-menu")) {
    document.querySelectorAll(".action-menu[open]").forEach((menu) => { menu.open = false; });
  }
  if (event.target.closest(".sidebar .nav-link")) document.getElementById("sidebar").classList.remove("sidebar-open");
});
document.getElementById("menu-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("sidebar-open");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !profileModal.hidden) closeProfile();
  else if (event.key === "Escape" && !modal.hidden) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

const currentDate = new Date();
const academicYearStart = currentDate.getMonth() >= 6 ? currentDate.getFullYear() : currentDate.getFullYear() - 1;
document.getElementById("semester-year").textContent = `${academicYearStart}–${String(academicYearStart + 1).slice(-2)} academic year`;
loadStudents();
loadStats();
