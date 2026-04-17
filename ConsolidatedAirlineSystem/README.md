# AirlineOps — Staff Management System

Phase 1 implementation. No database. All data is mocked in-memory.

## Quick Start

### Backend (.NET 8)
```bash
cd backend
dotnet restore
dotnet run
# Runs on http://localhost:5000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## Demo Credentials (password: `password123`)

| Role    | Email                  |
|---------|------------------------|
| Staff   | staff1@airline.com     |
| Staff   | staff2@airline.com     |
| Agent   | agent1@airline.com     |
| Manager | manager1@airline.com   |
| Admin   | admin@airline.com      |

## API (base: `/api/v1/`)

| Method | Endpoint                            | Auth         |
|--------|-------------------------------------|--------------|
| POST   | `/auth/login`                       | Public       |
| GET    | `/shifts/my?days=30`                | Any user     |
| GET    | `/shifts/all`                       | Manager/Admin|
| POST   | `/shifts/request`                   | Staff/Agent  |
| GET    | `/shifts/requests/my`               | Any user     |
| GET    | `/shifts/requests`                  | Manager/Admin|
| PUT    | `/shifts/requests/{id}/approve`     | Manager/Admin|
| PUT    | `/shifts/requests/{id}/reject`      | Manager/Admin|
| PUT    | `/shifts/{id}`                      | Manager/Admin|
| GET    | `/users`                            | Manager/Admin|

## Architecture

- **Backend**: ASP.NET Core 8 Web API, JWT Bearer auth, role-based authorization
- **Frontend**: React 18, Vite, TailwindCSS, Axios, React Router v6
- **Data**: Static in-memory C# lists — resets on restart
- **Auth**: JWT, 8-hour expiry, hardcoded secret (dev only)
