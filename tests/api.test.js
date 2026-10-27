const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { after, before, describe, it } = require("node:test");

const ROOT = join(__dirname, "..");
const sampleStudent = {
  firstName: "Taylor",
  lastName: "Bennett",
  email: "taylor.bennett@example.edu",
  department: "Social Sciences",
  program: "BA Psychology",
  yearOfStudy: 1,
  status: "Active",
  gpa: 3.7,
  phone: "+1 (555) 010-2403",
};

let serverProcess;
let dataDirectory;
let baseUrl;
let studentId;

async function getAvailablePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  listener.close();
  await once(listener, "close");
  return port;
}

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, body };
}

function jsonOptions(method, body) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

describe("Student Management System API", () => {
  before(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "student-management-test-"));
    const port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, [join(ROOT, "server.js")], {
      cwd: ROOT,
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDirectory },
      stdio: "ignore",
    });

    for (let attempt = 0; attempt < 100; attempt++) {
      if (serverProcess.exitCode !== null) throw new Error(`The API server exited with code ${serverProcess.exitCode}.`);
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) return;
      } catch {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      }
    }

    throw new Error("The API server did not start in time.");
  });

  after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      const exited = once(serverProcess, "exit");
      serverProcess.kill("SIGTERM");
      await exited;
    }
    if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
  });

  it("serves the dashboard, health check, and two sample students", async () => {
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Student directory/);

    const health = await request("/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");

    const students = await request("/api/students");
    assert.equal(students.body.students.length, 2);
    assert.equal(students.body.students[0].studentId, "STU-2025-001");
  });

  it("searches records safely, filters enrollment, and serves student details", async () => {
    assert.equal((await request("/api/students?search=avery")).body.students.length, 1);
    assert.equal((await request("/api/students?search=%25")).body.students.length, 0);
    assert.equal((await request("/api/students?status=Active")).body.students.length, 2);
    assert.equal((await request("/api/students/STU-2025-001")).body.student.firstName, "Avery");
    assert.equal((await request("/api/students/STU-9999-999")).status, 404);
  });

  it("creates students, rejects invalid and duplicate records", async () => {
    assert.equal((await request("/api/students", jsonOptions("POST", { ...sampleStudent, department: "Other" }))).status, 400);

    const created = await request("/api/students", jsonOptions("POST", sampleStudent));
    assert.equal(created.status, 201);
    studentId = created.body.student.studentId;
    assert.match(studentId, /^STU-\d{4}-\d{3}$/);

    const duplicate = await request("/api/students", jsonOptions("POST", sampleStudent));
    assert.equal(duplicate.status, 409);

    const stats = await request("/api/stats");
    assert.equal(stats.body.total, 3);
    assert.equal(stats.body.active, 3);
  });

  it("updates records and leaves them unchanged when an update conflicts", async () => {
    const updated = await request(
      `/api/students/${studentId}`,
      jsonOptions("PUT", { ...sampleStudent, firstName: "Taylor-Updated", status: "On leave", gpa: 3.8 }),
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.student.firstName, "Taylor-Updated");

    const conflict = await request(
      `/api/students/${studentId}`,
      jsonOptions("PUT", { ...sampleStudent, email: "avery.morgan@example.edu" }),
    );
    assert.equal(conflict.status, 409);
    assert.equal((await request(`/api/students/${studentId}`)).body.student.firstName, "Taylor-Updated");

    const missing = await request("/api/students/STU-9999-999", jsonOptions("PUT", sampleStudent));
    assert.equal(missing.status, 404);
  });

  it("rejects malformed or oversized JSON and deletes records", async () => {
    assert.equal((await request("/api/students", { method: "POST", body: "{" })).status, 400);
    const largeBody = " ".repeat(17_000);
    assert.equal((await request("/api/students", { method: "POST", body: largeBody })).status, 413);

    assert.equal((await request(`/api/students/${studentId}`, { method: "DELETE" })).status, 204);
    assert.equal((await request(`/api/students/${studentId}`)).status, 404);
    const stats = await request("/api/stats");
    assert.equal(stats.body.total, 2);
    assert.equal(stats.body.onLeave, 0);
  });
});
