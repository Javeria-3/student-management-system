# Northfield University Student Management System

A real, locally hosted student information system with a responsive university dashboard, full student CRUD operations, REST APIs, and a persistent SQLite database.

## Requirements

- [Node.js](https://nodejs.org/) 22.13 or newer. The application uses Node's built-in `node:sqlite` module; it has no external runtime dependencies.

## Start the application

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser. To use a different port, set the `PORT` environment variable before starting the server.

Development mode restarts the server when source files change:

```powershell
npm.cmd run dev
```

The app automatically creates `data\students.db` and seeds two fictional sample students on first launch. Student records are saved to this local database, which is intentionally excluded from Git.

## Student API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check application availability |
| `GET` | `/api/stats` | Read enrollment totals and average GPA |
| `GET` | `/api/students` | List students |
| `GET` | `/api/students?search=avery` | Search student IDs, names, email, departments, and programs |
| `GET` | `/api/students?status=Active` | Filter by enrollment status |
| `GET` | `/api/students/:studentId` | View a student's details |
| `POST` | `/api/students` | Add a student |
| `PUT` | `/api/students/:studentId` | Update a student's details |
| `DELETE` | `/api/students/:studentId` | Remove a student |

Example `POST` or `PUT` body:

```json
{
  "firstName": "Taylor",
  "lastName": "Bennett",
  "email": "taylor.bennett@example.edu",
  "department": "Social Sciences",
  "program": "BA Psychology",
  "yearOfStudy": 1,
  "status": "Active",
  "gpa": 3.7,
  "phone": "+1 (555) 010-2403"
}
```

Supported departments are Arts & Humanities, Business, Computer Science, Education, Engineering, Health Sciences, Natural Sciences, and Social Sciences. GPA must be between 0 and 4.0; year of study must be between 1 and 6.

## Project structure

```text
public/       Responsive application interface
data/         Automatically created, local SQLite database
server.js     REST API and static file server
package.json  Start and validation scripts
```

## Verify JavaScript syntax

```powershell
npm.cmd run check
```

Run the automated API tests with the built-in Node.js test runner:

```powershell
npm.cmd test
```

Tests run against an isolated temporary database and never overwrite `data\students.db`.

This educational starter intentionally keeps sample data and SQLite storage on the same device. Add authentication, user permissions, secure deployment configuration, and appropriate privacy protections before using real student information.
