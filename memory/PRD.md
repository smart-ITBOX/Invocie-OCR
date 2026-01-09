# Smart ITBOX - Invoice Processing Application

## Product Requirements Document

### Original Problem Statement
Build a mobile-responsive invoice processing application for CA firms that allows users to:
- Upload scanned invoices (images/PDFs)
- Extract key details using AI (OpenAI/Gemini)
- Display extracted data in a grid/table
- Cross-verify and manually edit extracted data
- Manage company settings (name, GST, logo)
- Generate GST reconciliation reports
- Bank reconciliation with payment matching

### User Personas
1. **CA Firm Staff** - Upload and verify invoices, manage company settings
2. **Super Admin** - Manage all users, view all invoices across companies
3. **Company Owner** - View reports, manage profile

### Core Requirements

#### Authentication
- [x] Email/password registration and login
- [x] JWT-based authentication
- [x] Password visibility toggle on login/register
- [x] Forgot password functionality (MOCKED - doesn't send actual email)
- [x] Admin role with elevated privileges

#### Invoice Management
- [x] Single and batch invoice upload (max 20 files)
- [x] AI-powered data extraction (OpenAI GPT-4o / Gemini 2.5 Flash)
- [x] Sales and Purchase invoice types
- [x] Invoice verification page with side-by-side comparison
- [x] Manual invoice entry for handwritten/unreadable invoices
- [x] Duplicate invoice detection
- [x] GST validation against company settings

#### Admin Panel
- [x] User management (enable/disable accounts)
- [x] View all users and their details
- [x] Password reset for users
- [x] View all invoices from all companies

#### Bank Reconciliation
- [x] Upload bank statements (PDF, Excel, CSV)
- [x] AI-powered transaction extraction
- [x] Fuzzy matching of payments to invoices
- [x] Manual transaction mapping UI
- [x] Outstanding report for receivables and payables

#### Reports & Analytics
- [x] Financial charts (Sales vs Purchase)
- [x] GST reconciliation report structure
- [ ] Export to Excel/CSV (planned)
- [ ] Tally XML export (future)

#### User Experience
- [x] Company branding (logo, name in header)
- [x] Settings page for company details
- [x] Profile page for user details
- [x] Enhanced menu bar with gradient styling
- [x] Settings tab positioned at end of navigation

### Technical Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Recharts
- **Backend**: FastAPI, Pydantic, Motor (MongoDB async)
- **Database**: MongoDB
- **AI**: OpenAI GPT-4o, Gemini 2.5 Flash via Emergent LLM Key
- **File Processing**: pypdf, pandas, openpyxl, xlrd
- **Matching**: thefuzz for fuzzy string matching

### API Endpoints

#### Auth
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request password reset (MOCKED)

#### Invoices
- `POST /api/invoices/upload` - Single invoice upload
- `POST /api/invoices/batch-upload` - Batch invoice upload
- `POST /api/invoices/manual` - Manual invoice entry
- `GET /api/invoices` - List user's invoices
- `GET /api/invoices/{id}` - Get invoice details
- `PUT /api/invoices/{id}` - Update invoice

#### Admin
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/{id}` - Update user status
- `POST /api/admin/users/{id}/reset-password` - Reset user password
- `GET /api/admin/invoices` - List all invoices

#### Bank Reconciliation
- `POST /api/bank/upload` - Upload bank statement
- `GET /api/bank/statements` - List statements
- `POST /api/bank/map-transaction` - Map transaction
- `GET /api/bank/reconciliation-report` - Get outstanding report

#### Settings & Profile
- `GET /api/settings/company` - Get company settings
- `POST /api/settings/company` - Update company settings
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me/profile` - Update user profile

### Database Collections
- `users` - User accounts with roles
- `invoices` - Uploaded and processed invoices
- `company_settings` - Company branding and GST details
- `bank_statements` - Uploaded bank statements
- `bank_transaction_mappings` - Manual transaction mappings
- `bank_payable_mappings` - Payable transaction mappings

### Test Credentials
- **Admin**: admin@test.com / admin123
- **Demo User**: demo@smartitbox.com / demo123

---

## Completed Work (Jan 9, 2026)

### Session Accomplishments
1. **Password View Toggle** - Added eye icon to show/hide password on login and register forms
2. **Forgot Password** - Added forgot password dialog and backend endpoint (MOCKED - doesn't send email)
3. **Admin Password Reset** - Added "Reset Password" button in admin panel for user accounts
4. **Manual Invoice Entry** - Full page with sales and purchase invoice forms, auto-calculation
5. **Enhanced Menu Bar** - Gradient styling, rounded tabs, better visual hierarchy
6. **Menu Reordering** - Settings tab moved to last position, Manual Entry added

### Files Modified
- `/app/frontend/src/pages/Login.jsx` - Password toggle, forgot password dialog
- `/app/frontend/src/pages/AdminDashboard.jsx` - Password reset button and dialog
- `/app/frontend/src/components/Layout.jsx` - Enhanced menu styling, reordering
- `/app/frontend/src/pages/ManualEntry.jsx` - Sales/Purchase entry forms
- `/app/frontend/src/App.js` - Added manual-entry route
- `/app/backend/server.py` - New endpoints for forgot-password, reset-password, manual invoice

---

## Backlog

### P0 (Critical)
- [ ] **Fix saving manual edits** - The "Cross Verify" save functionality may still be broken

### P1 (High Priority)
- [ ] Duplicate invoice validation feedback on frontend (toast notification)
- [ ] GST validation feedback on frontend (toast notification)
- [ ] Excel/CSV export for invoice list
- [ ] Implement actual email sending for forgot password

### P2 (Medium Priority)
- [ ] Complete GST Reconciliation report
- [ ] Search and bulk mapping in Bank Reconciliation
- [ ] Refactor server.py into separate routers (auth, invoices, admin, bank)

### P3 (Future)
- [ ] Tally XML export
- [ ] QuickBooks/Xero integration
- [ ] Line-item extraction from invoices
- [ ] Multi-tenancy and Stripe subscription billing
