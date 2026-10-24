# SIH26265 — Security Deposit / FDR Portal

This is a synthetic demonstration portal for AICTE security-deposit workflow modelling. It does not connect to AICTE, banks, or payment rails, and it must not be used with real institutional or financial documents.

## Run the demo

1. Create an environment and install the backend requirements:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and keep `DEMO_MODE=true`.

3. Create repeatable synthetic data:

   ```powershell
   python scripts\reset_demo.py --yes
   python scripts\seed_demo.py
   ```

4. Start the API and UI in separate terminals:

   ```powershell
   python -m uvicorn backend.main:app --reload
   cd frontend
   npm.cmd ci
   npm.cmd run dev
   ```

Open the frontend URL printed by Vite (normally `http://localhost:5173`). API documentation is at `http://localhost:8000/docs`.

All demo users use password `demo12345`:

- `inst_rep_1@demo.example` — institution representative
- `scrutiny_1@demo.example` — scrutiny officer
- `clearance_1@demo.example` — clearance officer
- `authority_1@demo.example` — authority simulation
- `approval_bureau_1@demo.example` — FDR/RPGF authority simulation
- `council_1@demo.example` — RTGS authority simulation
- `admin_1@demo.example` — system administration only

## Five-minute end-to-end simulation

1. As the institution representative, register an FDR/RPGF case and upload the required documents. Submission with a missing document shows a clear validation error.
2. Confirm review and submit; the scrutiny officer reviews it, requests a clarification, and the institution uploads a new evidence version.
3. Record separate Public Grievance Redressal Cell (PGRC), Vigilance Cell, and relevant Cell/Bureau clearances with evidence.
4. Request release. For FDR/RPGF, the authority records authorization only after the prerequisite checklist passes, then records the simulated Approval Bureau NOC. For RTGS, the equivalent output is a simulated Council sanction order.
5. Show the case audit trail and lifecycle dates. An authorization or output document is not a payment confirmation; the portal never claims that funds moved.

Use `python scripts\run_alerts.py` to run a simulated lifecycle alert scan. `python scripts\verify_audit.py` verifies the local audit chain.

## Checks

```powershell
$env:PYTHONPATH = (Get-Location).Path
pytest -q
cd frontend
npm.cmd run build
```

Clause 6.46 circumstances are represented as explicit `regulatory_context` booleans on a case: `external_financial_embezzlement`, `converted_or_deemed_university`, `progressive_closure`, and `merger_child_institution`. Their checklist gates are deliberately configurable in `config/rules.yaml`.
