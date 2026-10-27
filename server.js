const { createServer } = require("node:http");
const { DatabaseSync } = require("node:sqlite");
const { mkdirSync, readFileSync, statSync } = require("node:fs");
const { extname, join, resolve, sep } = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
const PUBLIC_DIR = resolve(__dirname, "public");
const MAX_BODY_BYTES = 16_384;
const STATUSES = new Set(["Active", "On leave", "Graduated"]);
const DEPARTMENTS = new Set([
  "Arts & Humanities",
  "Business",
  "Computer Science",
  "Education",
  "Engineering",
  "Health Sciences",
  "Natural Sciences",
  "Social Sciences",
]);

mkdirSync(DATA_DIR, { recursive: true });

const database = new DatabaseSync(join(DATA_DIR, "students.db"));
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    department TEXT NOT NULL,
    program TEXT NOT NULL,
    year_of_study INTEGER NOT NULL CHECK (year_of_study BETWEEN 1 AND 6),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On leave', 'Graduated')),
    gpa REAL NOT NULL DEFAULT 0 CHECK (gpa BETWEEN 0 AND 4),
    phone TEXT NOT NULL DEFAULT '',
    guardian_name TEXT NOT NULL DEFAULT '',
    guardian_relationship TEXT NOT NULL DEFAULT '',
    guardian_email TEXT NOT NULL DEFAULT '',
    guardian_phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_students_name ON students (last_name, first_name);
`);

const studentColumns = new Set(database.prepare("PRAGMA table_info(students)").all().map((column) => column.name));
for (const [name, definition] of [
  ["guardian_name", "TEXT NOT NULL DEFAULT ''"],
  ["guardian_relationship", "TEXT NOT NULL DEFAULT ''"],
  ["guardian_email", "TEXT NOT NULL DEFAULT ''"],
  ["guardian_phone", "TEXT NOT NULL DEFAULT ''"],
  ["address", "TEXT NOT NULL DEFAULT ''"],
]) {
  if (!studentColumns.has(name)) {
    database.exec(`ALTER TABLE students ADD COLUMN ${name} ${definition}`);
  }
}

if (database.prepare("SELECT COUNT(*) AS count FROM students").get().count === 0) {
  const seed = database.prepare(`
    INSERT INTO students (student_id, first_name, last_name, email, department, program, year_of_study, status, gpa, phone, guardian_name, guardian_relationship, guardian_email, guardian_phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  database.exec("BEGIN");
  try {
    for (const student of [
      ["STU-2025-001", "Avery", "Morgan", "avery.morgan@example.edu", "Computer Science", "BSc Computer Science", 3, "Active", 3.84, "+1 (555) 010-2401", "Alex Morgan", "Parent", "alex.morgan@example.edu", "+1 (555) 010-2400", ""],
      ["STU-2025-002", "Jordan", "Patel", "jordan.patel@example.edu", "Business", "BBA Business Administration", 2, "Active", 3.62, "+1 (555) 010-2402", "Samira Patel", "Parent", "samira.patel@example.edu", "+1 (555) 010-2403", ""],
    ]) {
      seed.run(...student);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

const filterStudentsQuery = database.prepare(`
  SELECT student_id AS studentId, first_name AS firstName, last_name AS lastName,
         email, department, program, year_of_study AS yearOfStudy, status, gpa, phone,
         guardian_name AS guardianName, guardian_relationship AS guardianRelationship,
         guardian_email AS guardianEmail, guardian_phone AS guardianPhone, address,
         created_at AS createdAt, updated_at AS updatedAt
  FROM students WHERE (? = '' OR status = ?)
    AND (? = 0 OR year_of_study = ?)
    AND (? = '' OR department = ?)
    AND (? = '' OR student_id LIKE ? ESCAPE '\\'
      OR first_name || ' ' || last_name LIKE ? ESCAPE '\\'
      OR email LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\' OR program LIKE ? ESCAPE '\\')
  ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
`);
const getStudentQuery = database.prepare(`
  SELECT student_id AS studentId, first_name AS firstName, last_name AS lastName,
         email, department, program, year_of_study AS yearOfStudy, status, gpa, phone,
         guardian_name AS guardianName, guardian_relationship AS guardianRelationship,
         guardian_email AS guardianEmail, guardian_phone AS guardianPhone, address,
         created_at AS createdAt, updated_at AS updatedAt
  FROM students WHERE student_id = ?
`);
const insertStudent = database.prepare(`
  INSERT INTO students (student_id, first_name, last_name, email, department, program, year_of_study, status, gpa, phone, guardian_name, guardian_relationship, guardian_email, guardian_phone, address)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const nextStudentNumber = database.prepare(`
  SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'students'), 0) + 1 AS nextId
`);
const updateStudent = database.prepare(`
  UPDATE students SET first_name = ?, last_name = ?, email = ?, department = ?, program = ?,
    year_of_study = ?, status = ?, gpa = ?, phone = ?, guardian_name = ?, guardian_relationship = ?,
    guardian_email = ?, guardian_phone = ?, address = ?, updated_at = datetime('now')
  WHERE student_id = ?
`);
const deleteStudent = database.prepare("DELETE FROM students WHERE student_id = ?");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    let body = "";
    let tooLarge = false;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        rejectBody(Object.assign(new Error("Request body must not exceed 16 KB."), { status: 413 }));
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      if (tooLarge) return;
      if (!body) {
        rejectBody(Object.assign(new Error("A JSON request body is required."), { status: 400 }));
        return;
      }
      try {
        const value = JSON.parse(body);
        if (value === null || Array.isArray(value) || typeof value !== "object") {
          rejectBody(Object.assign(new Error("The request body must be a JSON object."), { status: 400 }));
          return;
        }
        resolveBody(value);
      } catch {
        rejectBody(Object.assign(new Error("The request body contains invalid JSON."), { status: 400 }));
      }
    });
    request.on("error", rejectBody);
  });
}

function validateStudent(input) {
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const department = typeof input.department === "string" ? input.department.trim() : "";
  const program = typeof input.program === "string" ? input.program.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const guardianName = typeof input.guardianName === "string" ? input.guardianName.trim() : "";
  const guardianRelationship = typeof input.guardianRelationship === "string" ? input.guardianRelationship.trim() : "";
  const guardianEmail = typeof input.guardianEmail === "string" ? input.guardianEmail.trim().toLowerCase() : "";
  const guardianPhone = typeof input.guardianPhone === "string" ? input.guardianPhone.trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";
  const yearOfStudy = Number(input.yearOfStudy);
  const gpa = Number(input.gpa);

  if (!firstName || firstName.length > 80) return { error: "First name is required and must be 80 characters or fewer." };
  if (!lastName || lastName.length > 80) return { error: "Last name is required and must be 80 characters or fewer." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!DEPARTMENTS.has(department)) return { error: "Select a valid department." };
  if (!program || program.length > 120) return { error: "Program is required and must be 120 characters or fewer." };
  if (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 6) return { error: "Year of study must be between 1 and 6." };
  if (!STATUSES.has(input.status)) return { error: "Select a valid enrollment status." };
  if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4) return { error: "GPA must be between 0 and 4." };
  if (phone.length > 30) return { error: "Phone number must be 30 characters or fewer." };
  if (guardianName.length > 100) return { error: "Parent or guardian name must be 100 characters or fewer." };
  if (guardianRelationship.length > 30) return { error: "Relationship must be 30 characters or fewer." };
  if (guardianEmail && (guardianEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))) return { error: "Enter a valid parent or guardian email address." };
  if (guardianPhone.length > 30) return { error: "Parent or guardian phone number must be 30 characters or fewer." };
  if (address.length > 200) return { error: "Address must be 200 characters or fewer." };

  return {
    student: { firstName, lastName, email, department, program, yearOfStudy, status: input.status, gpa, phone, guardianName, guardianRelationship, guardianEmail, guardianPhone, address },
  };
}

function handleApi(request, response, url) {
  const studentMatch = /^\/api\/students\/([^/]+)$/.exec(url.pathname);
  const studentId = studentMatch ? decodeURIComponent(studentMatch[1]) : null;

  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/api/stats" && request.method === "GET") {
    const stats = database.prepare(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN status = 'On leave' THEN 1 ELSE 0 END), 0) AS onLeave,
        COALESCE(SUM(CASE WHEN status = 'Graduated' THEN 1 ELSE 0 END), 0) AS graduated,
        COALESCE(ROUND(AVG(gpa), 2), 0) AS averageGpa
      FROM students
    `).get();
    sendJson(response, 200, stats);
    return;
  }

  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    const stats = database.prepare(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN status = 'On leave' THEN 1 ELSE 0 END), 0) AS onLeave,
        COALESCE(SUM(CASE WHEN status = 'Graduated' THEN 1 ELSE 0 END), 0) AS graduated,
        COALESCE(ROUND(AVG(gpa), 2), 0) AS averageGpa,
        COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-90 days') THEN 1 ELSE 0 END), 0) AS recentAdmissions
      FROM students
    `).get();
    const academicYears = database.prepare(`
      SELECT year_of_study AS yearOfStudy, COUNT(*) AS students,
        ROUND(AVG(gpa), 2) AS averageGpa
      FROM students GROUP BY year_of_study ORDER BY year_of_study
    `).all();
    const departments = database.prepare(`
      SELECT department, COUNT(*) AS students
      FROM students GROUP BY department ORDER BY students DESC, department COLLATE NOCASE LIMIT 5
    `).all();
    const recentRegistrations = database.prepare(`
      SELECT student_id AS studentId, first_name AS firstName, last_name AS lastName,
        department, program, year_of_study AS yearOfStudy, created_at AS createdAt
      FROM students ORDER BY created_at DESC, id DESC LIMIT 4
    `).all();

    sendJson(response, 200, { stats, academicYears, departments, recentRegistrations });
    return;
  }

  if (url.pathname === "/api/students" && request.method === "GET") {
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const status = url.searchParams.get("status") || "";
    const yearOfStudy = Number(url.searchParams.get("yearOfStudy")) || 0;
    const department = url.searchParams.get("department") || "";
    const filter = status === "All statuses" ? "" : status;
    const searchTerm = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : "";
    const students = filterStudentsQuery.all(
      filter,
      filter,
      yearOfStudy,
      yearOfStudy,
      department,
      department,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
    );
    sendJson(response, 200, { students });
    return;
  }

  if (url.pathname === "/api/students" && request.method === "POST") {
    void readJson(request).then((body) => {
      const { student, error } = validateStudent(body);
      if (error) {
        sendJson(response, 400, { error });
        return;
      }
      const studentId = `STU-${new Date().getFullYear()}-${String(nextStudentNumber.get().nextId).padStart(3, "0")}`;
      insertStudent.run(studentId, student.firstName, student.lastName, student.email, student.department, student.program, student.yearOfStudy, student.status, student.gpa, student.phone, student.guardianName, student.guardianRelationship, student.guardianEmail, student.guardianPhone, student.address);
      sendJson(response, 201, { student: getStudentQuery.get(studentId) });
    }).catch((error) => {
      if (error.status) sendJson(response, error.status, { error: error.message });
      else if (error.errcode === 2067) sendJson(response, 409, { error: "A student with this email address already exists." });
      else {
        console.error("Failed to create student:", error);
        sendJson(response, 500, { error: "Unable to save the student. Please try again." });
      }
    });
    return;
  }

  if (studentId && request.method === "GET") {
    const student = getStudentQuery.get(studentId);
    if (!student) {
      sendJson(response, 404, { error: "Student not found." });
      return;
    }
    sendJson(response, 200, { student });
    return;
  }

  if (studentId && request.method === "PUT") {
    void readJson(request).then((body) => {
      const { student, error } = validateStudent(body);
      if (error) {
        sendJson(response, 400, { error });
        return;
      }
      const result = updateStudent.run(student.firstName, student.lastName, student.email, student.department, student.program, student.yearOfStudy, student.status, student.gpa, student.phone, student.guardianName, student.guardianRelationship, student.guardianEmail, student.guardianPhone, student.address, studentId);
      if (Number(result.changes) === 0) {
        sendJson(response, 404, { error: "Student not found." });
        return;
      }
      sendJson(response, 200, { student: getStudentQuery.get(studentId) });
    }).catch((error) => {
      if (error.status) sendJson(response, error.status, { error: error.message });
      else if (error.errcode === 2067) sendJson(response, 409, { error: "A student with this email address already exists." });
      else {
        console.error("Failed to update student:", error);
        sendJson(response, 500, { error: "Unable to update the student. Please try again." });
      }
    });
    return;
  }

  if (studentId && request.method === "DELETE") {
    const result = deleteStudent.run(studentId);
    if (Number(result.changes) === 0) {
      sendJson(response, 404, { error: "Student not found." });
      return;
    }
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API endpoint not found." });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = resolve(PUBLIC_DIR, `.${requestedPath}`);

  if (!filePath.startsWith(`${PUBLIC_DIR}${sep}`) || !statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
    sendJson(response, 404, { error: "Page not found." });
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(readFileSync(filePath));
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || HOST}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(request, response, url);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    serveStatic(response, url.pathname);
  } catch (error) {
    if (error instanceof URIError) {
      sendJson(response, 400, { error: "The requested URL is invalid." });
      return;
    }
    console.error("Request failed:", error);
    if (!response.headersSent) sendJson(response, 500, { error: "An unexpected server error occurred." });
    else response.destroy(error);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Student Management System running at http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}
