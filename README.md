# SIH26265 — AICTE Security Deposit & FDR Portal

A secure, audit-compliant digital portal for AICTE Security Deposit / Fixed Deposit Receipt (FDR) / RPGF and RTGS lifecycle management. This platform models end-to-end institution deposit submissions, document verification, multi-cell scrutiny and clearance, authority authorizations, and cryptographic audit logging.

> **Disclaimer**: This is a demonstration and workflow-modelling portal for AICTE security deposit processes. It operates in synthetic demo mode with simulated banking and authorization workflows and does not execute real-world financial transactions.

---

## Table of Contents

- [Key Features](#key-features)
- [Workflow Overview](#workflow-overview)
- [User Personas & Demo Accounts](#user-personas--demo-accounts)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Database Seeding](#database-seeding)
- [Operational Scripts](#operational-scripts)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Security & Compliance Architecture](#security--compliance-architecture)
- [Project Structure](#project-structure)

---

## Key Features

- **Multi-Step Case Registration**: Structured wizard guiding institutions through deposit details, regulatory declarations, and document uploads.
- **Intelligent Evidence Management**:
  - Secure upload supporting PDF, JPEG, PNG, and TIFF formats.
  - Interactive document viewer with in-browser PDF preview, image zoom/rotation, full-screen mode, and fallback download.
  - OCR extraction pipeline extracting structured metadata (FDR numbers, bank names, maturity dates, amounts).
  - SHA-256 integrity verification and automated synthetic fallback generation in demo mode.
- **Scrutiny & Review Workflow**:
  - Real-time scrutiny queues with status filtering and metrics.
  - Clarification request workflows with institution document re-submission.
  - Case assignment and strict status-transition validations.
- **Independent Multi-Officer Clearance**:
  - Independent clearance queues for **Public Grievance Redressal Cell (PGRC)**, **Vigilance Cell**, and **Technical Cell/Bureau**.
  - Distinct task ownership ensuring all clearances must be completed prior to release readiness.
- **Authority Release Authorization**:
  - Role-gated authorizations: FDR/RPGF release via Approval Bureau NOC; RTGS refund via Council Sanction Order.
  - Clause 6.46 checklist gating (progressive closure, deemed university status, embezzlement, mergers).
- **Cryptographic Audit Trail**:
  - Append-only hash-chained audit log (`SHA-256(prev_hash + entity + action + actor + timestamp)`).
  - Periodic checkpoint signatures and local chain verification utilities.
- **Monitoring, Alerts & Reports**:
  - Persona-scoped operational reports with CSV export.
  - Automated alert scheduler for deposit maturity warnings (30/60/90 days), pending clarifications, and overdue clearance tasks.

---

## Workflow Overview

```
[ Institution ]
      │  Creates Deposit Case & Uploads Evidence (FDR / Bank Guarantee / RTGS)
      ▼
[ Scrutiny Officer ]
      │  Reviews Case & Evidence Documents
      ├─► Requests Clarification ──► Institution Updates Evidence
      └─► Approves & Moves to Clearance Queue
      ▼
[ Clearance Officers ] (Multi-Cell Independent Reviews)
      ├── Public Grievance Redressal Cell (PGRC) Clear
      ├── Vigilance Cell Clear
      └── Technical Cell / Bureau Clear
      ▼
[ Competent Authority ] (Approval Bureau / Council)
      │  Evaluates Release Checklist & Regulatory Clause 6.46 Gates
      ▼
[ Release Decision Recorded ]
      │  Simulated Approval Bureau NOC (FDR) / Council Sanction Order (RTGS)
      ▼
[ Cryptographic Audit Log ] (Immutable record of every state change & action)
```

---

## User Personas & Demo Accounts

All demo accounts use the standard password: **`demo12345`**

| Role | Email | Description |
|---|---|---|
| **Institution Representative** | `inst_rep_1@demo.example` | Creates and manages deposit cases, uploads documents, requests release or renewal |
| **Scrutiny Officer** | `scrutiny_1@demo.example` | Inspects submitted cases, reviews OCR metadata, requests clarifications, approves scrutiny |
| **Clearance Officer (PGRC)** | `clearance_1@demo.example` | Processes Public Grievance Redressal Cell clearances |
| **Clearance Officer (Vigilance)** | `clearance_2@demo.example` | Conducts Vigilance Cell reviews and clearance decisions |
| **Clearance Officer (Technical)** | `clearance_3@demo.example` | Evaluates Technical Cell / Bureau clearances |
| **Competent Authority** | `authority_1@demo.example` | Reviews overall case readiness and authorizes release |
| **Approval Bureau** | `approval_bureau_1@demo.example` | Authority for FDR/RPGF NOC issuance |
| **Council Authority** | `council_1@demo.example` | Authority for RTGS sanction orders |
| **System Administrator** | `admin_1@demo.example` | Full system administration, audit inspection, and queue governance |

---

## Tech Stack

### Backend
- **Framework**: Python 3.12+, FastAPI
- **Database & ORM**: SQLAlchemy 2.0 (Asyncio), SQLite (default demo) / PostgreSQL
- **Security**: JWT Authentication (Access + Signed Refresh Tokens), Argon2 / Bcrypt hashing, Role-Based Access Control (RBAC)
- **Document Processing**: PyPDF2, Pytesseract OCR, Pillow
- **Testing**: Pytest, Pytest-Asyncio, HTTPX

### Frontend
- **Framework**: React 18 with TypeScript
- **Bundler & Tooling**: Vite
- **Styling**: Tailwind CSS, Vanilla CSS design tokens
- **Icons**: Lucide React
- **State & HTTP**: Context API, Axios / Fetch API

---

## Getting Started

### Prerequisites
- **Python**: 3.12 or newer
- **Node.js**: 18.x or newer (with npm)
- **Git**

### Backend Setup

1. **Create and activate a virtual environment:**

   *Windows PowerShell:*
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   *macOS / Linux:*
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```
   *(Keep `DEMO_MODE=true` for demonstration and synthetic data generation).*

### Frontend Setup

1. **Install dependencies:**
   ```powershell
   cd frontend
   npm ci
   ```

2. **Return to root directory:**
   ```powershell
   cd ..
   ```

### Database Seeding

Initialize the database schema and populate repeatable synthetic demo records:

```powershell
python scripts\reset_demo.py --yes
python scripts\seed_demo.py
```

### Running the Application

Start backend and frontend services in separate terminal windows:

**Terminal 1 (Backend API):**
```powershell
python -m uvicorn backend.main:app --reload --port 8000
```
- Swagger API Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

**Terminal 2 (Frontend Client):**
```powershell
cd frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

## Operational Scripts

- **Reset Demo Data**:
  ```powershell
  python scripts\reset_demo.py --yes
  ```
- **Seed Demo Data**:
  ```powershell
  python scripts\seed_demo.py
  ```
- **Run Lifecycle Alert Engine**:
  Scans for maturing instruments, overdue clearances, and unresolved clarifications:
  ```powershell
  python scripts\run_alerts.py
  ```
- **Verify Cryptographic Audit Chain**:
  Validates SHA-256 continuity and detects any manual database tampering:
  ```powershell
  python scripts\verify_audit.py
  ```

---

## Testing & Quality Assurance

Run the comprehensive automated test suite (60+ unit and integration tests) and verify frontend type safety:

```powershell
# Run backend pytest suite
$env:PYTHONPATH = (Get-Location).Path
pytest -v

# Run frontend type-check & production build
cd frontend
npm run build
cd ..
```

---

## Security & Compliance Architecture

1. **Cryptographic Hash Chaining**: Every lifecycle event (case submission, review decision, clearance approval, document upload) records a SHA-256 hash linked to the previous sequence block. Any database alteration breaks the chain.
2. **Access Control**: Fine-grained RBAC enforces endpoint authorization across institution representatives, scrutiny officers, multi-cell clearance officers, authorities, and system administrators.
3. **Audit Immutability**: Serialized JSON audit payloads normalize dates, decimals, and UUIDs to guarantee deterministic hash calculation across platforms.
4. **Regulatory Clause 6.46 Compliance**: Built-in checklist gates evaluate conditions such as progressive closure, university conversion, financial dispute holds, and institution mergers before release authorization.

---

## Project Structure

```
Sih26psfdr/
├── backend/
│   ├── config.py              # Application settings & environment config
│   ├── database.py            # Async SQLAlchemy engine & session factory
│   ├── main.py                # FastAPI entry point & router registration
│   ├── models/                # SQLAlchemy database models (Case, Evidence, Audit, User)
│   ├── routes/                # API endpoints (Auth, Cases, Evidence, Scrutiny, Clearance, Release, Reports)
│   ├── schemas/               # Pydantic validation models
│   └── services/              # Business logic (CaseService, AuditService, FileStorage, OCR, Rules)
├── config/
│   └── rules.yaml             # Configurable regulatory checklist rules
├── frontend/
│   ├── src/
│   │   ├── api/               # API clients for cases, clearance, evidence, etc.
│   │   ├── components/        # UI components (DocumentViewer, Modals, Forms, Navigation)
│   │   ├── context/           # React context providers (AuthContext, etc.)
│   │   ├── pages/             # Persona-specific views (Institution, Scrutiny, Clearance, Authority, Admin)
│   │   └── types/             # TypeScript interfaces & enums
│   ├── package.json
│   └── vite.config.ts
├── scripts/                   # CLI maintenance & demo management scripts
└── tests/                     # Unit and integration test suites
```

---

## License

This project is developed for the Smart India Hackathon (SIH 2026) demonstration. All rights reserved.
