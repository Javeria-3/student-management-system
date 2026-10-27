const studentRows = document.getElementById("student-rows");
const searchInput = document.getElementById("student-search");
const statusFilter = document.getElementById("status-filter");
const modal = document.getElementById("student-modal");
const studentForm = document.getElementById("student-form");
const formError = document.getElementById("form-error");
const saveButton = document.getElementById("save-student");
const toastRegion = document.getElementById("toast-region");

let editingStudentId = null;
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
      <td><div class="student-person"><span class="student-avatar avatar-tone-${index % 5}">${escapeHtml(initials(student))}</span><span class="student-person-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(student.email)}</span></span></div></td>
      <td><span class="student-id">${escapeHtml(student.studentId)}</span></td>
      <td><div class="program-cell"><strong>${escapeHtml(student.department)}</strong><span>${escapeHtml(student.program)}</span></div></td>
      <td><span class="year-badge">Year ${escapeHtml(student.yearOfStudy)}</span></td>
      <td><span class="gpa-cell">${Number(student.gpa).toFixed(2)}<span> / 4.0</span></span></td>
      <td><span class="status-badge ${statusClass}"><span></span>${escapeHtml(student.status)}</span></td>
      <td class="action-cell">
        <details class="action-menu">
          <summary class="icon-button row-menu-button" aria-label="Actions for ${escapeHtml(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></summary>
          <div class="action-popover">
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
  studentRows.querySelectorAll(".delete-student").forEach((button) => {
    button.addEventListener("click", () => removeStudent(button.dataset.studentId));
  });
}

async function loadStudents() {
  const query = new URLSearchParams();
  if (searchInput.value.trim()) query.set("search", searchInput.value.trim());
  if (statusFilter.value !== "All statuses") query.set("status", statusFilter.value);

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

async function loadStats() {
  try {
    const stats = await request("/api/stats");
    document.getElementById("stat-total").textContent = stats.total.toLocaleString();
    document.getElementById("stat-active").textContent = stats.active.toLocaleString();
    document.getElementById("stat-leave").textContent = stats.onLeave.toLocaleString();
    document.getElementById("stat-gpa").textContent = Number(stats.averageGpa).toFixed(2);
    document.getElementById("nav-count").textContent = stats.total > 99 ? "99+" : stats.total;
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
document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("cancel-modal").addEventListener("click", closeModal);
studentForm.addEventListener("submit", saveStudent);
statusFilter.addEventListener("change", loadStudents);
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadStudents, 180);
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".action-menu")) {
    document.querySelectorAll(".action-menu[open]").forEach((menu) => { menu.open = false; });
  }
  if (event.target.closest("[data-coming-soon]")) {
    event.preventDefault();
    showToast("We're making room for this campus feature. Check back soon!", "error");
  }
});
document.getElementById("menu-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("sidebar-open");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

document.getElementById("semester-year").textContent = new Date().getFullYear();
loadStudents();
loadStats();
