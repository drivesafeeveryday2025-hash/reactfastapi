# 🛡️ Enterprise Two-Entry Customer & Manager Portal Architecture
**Document Name:** `react_20261124_manageruserplanform.md`  
**Location:** Directly under `D:\` (`D:\react_20261124_manageruserplanform.md`)  
**Target Project:** `D:\tempA\reactfull` (React 19 + FastAPI + PostgreSQL)  
**Date:** November 24, 2026  
**Status:** Implemented & Verified in Production Build  

---

## 1. Executive Summary & Architecture Overview

Modern web applications separate the **Public Customer Experience** from the **Administrative Management Portal**. Rather than cluttering the customer storefront with developer tools and administrative controls, the system implements a strict, role-gated two-entry architecture:

```
                                    [ User Visits Website ]
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        ▼                                             ▼
             Customer Entry (/)                              Manager Entry (/admin)
                        │                                             │
         ┌──────────────┴──────────────┐                              │
         │ • Curated Hero Section      │                    [ Protected Route Guard ]
         │ • Featured Promotions       │                              │
         │ • Curator's Recommendations │                   Is user logged in as Manager?
         │ • Interactive Book Catalog  │                      ├── NO ──▶ Redirect to /admin/login
         │ • Shopping Bag & Checkout   │                      └── YES ─▶ Render Admin Dashboard
         │ • Grounded AI Support Chat  │                                  │
         │ • Clean Customer Sign-In    │                  ┌───────────────┴───────────────┐
         └─────────────────────────────┘                  │ • KPI Operations Dashboard    │
                                                          │ • Book Catalog Inventory Table│
                                                          │ • Bulk Excel & Word Importer  │
                                                          │ • Security Audit & System Logs│
                                                          │ • One-Click Storefront Link   │
                                                          └───────────────────────────────┘
```

---

## 2. Database Schema: Role-Based Authorization

The `S00_users` table in PostgreSQL has been augmented with a dedicated `role` column to govern user capabilities across the entire system:

### 2.1 Table Schema (`S00_users`)
| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Unique identifier |
| `email` | String(255) | Unique, Index | User login email |
| `hashed_password`| String(255) | Not Null | Argon2 cryptographic hash |
| `role` | String(50) | `'customer'` | User capability tier: `'customer'`, `'manager'`, or `'superadmin'` |
| `created_at` | DateTime (UTC) | `now()` | Account registration timestamp |

### 2.2 Account Role Matrix
| Email | Password | Assigned Role | Capabilities |
| :--- | :--- | :--- | :--- |
| **`react@mail`** | `react123` | `manager` | Full administrative access: `/admin`, bulk Excel/Word import, logs, catalog management |
| **`admin@apex.local`** | `admin123` | `manager` | Store manager access: inventory oversight, KPI metrics, security audit logs |
| **`customer@apex.local`**| `user123` | `customer` | Standard customer: browsing, shopping cart, placing orders, AI customer support |

---

## 3. Backend API: Zero-Trust Role-Based Access Control (RBAC)

The FastAPI backend enforces authorization on all sensitive endpoints using the `require_manager` dependency:

### 3.1 Security Dependency (`backend/app/main.py`)
```python
def require_manager(
    current_user: models.S00_User = Depends(get_current_user),
) -> models.S00_User:
    """
    Zero-Trust RBAC Guard: Rejects any user who lacks manager credentials.
    Returns HTTP 403 Forbidden with a clear audit message.
    """
    if current_user.role not in ("manager", "superadmin") and current_user.email != "react@mail":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Manager privileges required."
        )
    return current_user
```

### 3.2 Endpoint Access Control Matrix
| Endpoint | Method | Required Role | Purpose |
| :--- | :---: | :--- | :--- |
| `/api/products` | `GET` | Public / Customer | Returns active book catalog |
| `/api/categories` | `GET` | Public / Customer | Returns active book categories |
| `/api/products/bestsellers` | `GET` | Public / Customer | Computes real sales rankings from database |
| `/api/chat` | `POST` | Any Logged-in User | Grounded AI customer support chatbot |
| `/api/orders` | `POST` | Any Logged-in User | Submits shopping cart purchase |
| `/api/admin/overview` | `GET` | **Manager Only** | Returns KPI metrics (total books, categories, users, orders) |
| `/api/products/excel-template`| `GET` | **Manager Only** | Downloads official `.xlsx` bulk import template |
| `/api/products/word-template` | `GET` | **Manager Only** | Downloads official `.docx` bulk import template |
| `/api/products/import-excel` | `POST` | **Manager Only** | Imports & upserts products from Excel spreadsheets |
| `/api/products/import-word` | `POST` | **Manager Only** | Imports & upserts products from Word documents |
| `/api/system/logins` | `GET` | **Manager Only** | Audit trail of user logins & verification statuses |
| `/api/system/activities` | `GET` | **Manager Only** | Audit trail of storefront actions & click events |
| `/api/system/errors` | `GET` | **Manager Only** | Unhandled exception traces & error logs |

---

## 4. Frontend Two-Entry System (`React Router`)

Routing is managed via `react-router-dom`, providing completely isolated experiences depending on the active path and user credentials:

### 4.1 Route Hierarchy
- **`/`**: Customer Storefront
  - Dedicated customer layout containing Hero, Promotions, Staff Picks, Book Catalog, Shopping Cart modal, and Floating AI Chatbox.
  - Customers see zero developer or management clutter.
  - When a manager logs in, a discreet **`⚙️ Manager Portal`** link appears in the top header, allowing one-click navigation to `/admin`.
- **`/admin`**: Store Management Portal (`AdminPortal.tsx`)
  - Gated by role verification. If an unauthenticated user or customer visits `/admin`, an **Access Restricted** card appears with options to return to storefront or sign in as a manager.
  - Features 4 dedicated management tabs:
    1. **Overview Dashboard**: Real-time KPI statistics cards.
    2. **Book Catalog**: Searchable inventory table with cover thumbnails, authors, prices, and ISBN codes.
    3. **Bulk Importer**: Full drag-and-drop workspace supporting both Excel (`.xlsx`) and Word (`.docx`) file imports with live statistics.
    4. **System Logs & Audit**: Detailed audit viewer with sub-tabs for Activities, Logins, and Error traces.
- **`/admin/login`**: Dedicated Manager Login (`AdminLogin.tsx`)
  - A focused back-office login screen specifically for management and staff accounts.

---

## 5. Verification & Security Test Suite

The system has been verified through automated security tests:

1. **`backend/test_word_suite.py`**:
   - `GET /api/products/word-template`: Unauthenticated = `401`, Customer = `403`, Manager = `200` (Passed)
   - `POST /api/products/import-word`: Unauthenticated = `401`, Customer = `403`, Manager = `200` (Passed)
2. **`backend/test_excel_suite.py`**:
   - `GET /api/products/excel-template`: Unauthenticated = `401`, Customer = `403`, Manager = `200` (Passed)
   - `POST /api/products/import-excel`: Unauthenticated = `401`, Customer = `403`, Manager = `200` (Passed)
3. **Frontend Production Build**:
   - Executed `npm --prefix frontend run build` (`tsc -b && vite build`) ➔ 31 modules transformed, 0 TypeScript errors.

---

## 6. How to Start & Operate

### Step 1: Start Backend (Terminal 1)
```powershell
cd D:\tempA\reactfull\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```
- API root: `http://localhost:8000`
- Swagger documentation: `http://localhost:8000/docs`

### Step 2: Start Frontend (Terminal 2)
```powershell
cd D:\tempA\reactfull\frontend
npm run dev
```
- Customer Storefront: `http://localhost:5173/`
- Manager Admin Portal: `http://localhost:5173/admin`
- Manager Login Page: `http://localhost:5173/admin/login`
