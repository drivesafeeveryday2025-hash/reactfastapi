# 🚀 Project Daily Startup Guide

This document contains the exact steps and commands to start your **React + FastAPI + PostgreSQL** project every day.

---

## ⚡ Quick Daily Routine (Open 2 Terminals in VS Code)

Whenever you open VS Code to work on this project, press **``Ctrl + ` ``** (Ctrl + Tilde) to open the terminal panel, and run these two commands:

### 🟢 Terminal 1: Start the Backend (FastAPI)

1. Ensure you are in the `backend` folder and activate the Python virtual environment:
   ```powershell
   cd D:\tempA\reactfull\backend
   .\.venv\Scripts\Activate.ps1
   ```
   *(You should see `(.venv)` appear on the left of your terminal prompt).*

2. Start the FastAPI server with live auto-reload:
   ```powershell
   uvicorn app.main:app --reload
   ```

3. **Verify:**
   - Backend API: `http://localhost:8000`
   - Interactive API Docs (Swagger): `http://localhost:8000/docs`

---

### 🔵 Terminal 2: Start the Frontend (React + Vite)

1. Click the **`+`** icon in VS Code's terminal panel to open a second terminal.
2. Navigate to the `frontend` folder:
   ```powershell
   cd D:\tempA\reactfull\frontend
   ```

3. Start the Vite development server:
   ```powershell
   npm run dev
   ```

4. **Verify:**
   - Open your browser to: **`http://localhost:5173`**

---

## 🌐 URLs & Tools Summary

| Service | Address | What it does |
| :--- | :--- | :--- |
| **Customer Storefront** | `http://localhost:5173/` | Customer-facing bookstore: browsing, cart, checkout, AI support |
| **Manager Admin Portal** | `http://localhost:5173/admin` | Management portal: KPI metrics, book inventory, bulk import, audit logs |
| **Manager Login Page** | `http://localhost:5173/admin/login` | Dedicated sign-in page for store managers and administrative staff |
| **FastAPI Swagger Docs** | `http://localhost:8000/docs` | Test backend endpoints, inspect schemas and API definitions |
| **PostgreSQL Database** | Port `5432` / DB: `appdb` | Inspect tables via **pgAdmin 4** (`S00_` and `C00_` tables) |

---

## 🔑 Demo Sign-in Accounts (Seeded in Database)

| Account Role | Email | Password | Role & Permissions |
| :--- | :--- | :--- | :--- |
| **Manager (Bulk Importer)** | `react@mail` | `react123` | `manager` ➔ Full access to `/admin`, Excel/Word bulk import, system logs, inventory |
| **Store Manager** | `admin@apex.local` | `admin123` | `manager` ➔ Full access to `/admin`, KPI dashboard, system audit logs |
| **Customer** | `customer@apex.local` | `user123` | `customer` ➔ Standard customer: browsing, cart, orders, AI chatbot (blocked from `/admin`) |

---

## 🤖 AI Bookstore Chatbot Testing Guide

The bookstore chatbot is protected by JWT authentication and rate limiting (max 5 msgs/min).

1. Open **`http://localhost:5173`**
2. Click **Login** at the top right and sign in with `customer@apex.local` / `user123`.
3. Click the bottom-right floating chat bubble (💬) to open the assistant.
4. Try these test queries:
   - **Store Return Policy:** `"我的書有破損,我要退款要怎麼退款?"` ➔ Answers with store's 7-day unconditional policy.
   - **Zero-Hallucination Inventory Check:** `"我要找日本語言學習相關的書"` ➔ Accurately states that the bookstore does not stock Japanese learning books (zero hallucination).
   - **Target Recommendation:** `"推薦適合國小男生的書"` ➔ Recommends *The Little Prince* from the store's children's literature catalog.
   - **Real Bestseller Ranking:** `"熱門暢銷排行榜"` ➔ Computes real order statistics from PostgreSQL orders table (`C00_order_items`).
   - **Security Refusal:** `"What is my account password?"` ➔ Refuses to disclose password, explains Argon2 cryptographic hashing.
   - **Bot Protection & Quota Limiter:** Send 6 messages in quick succession ➔ Automatically triggers HTTP 429 rate limit warning.

---

## 📊 Excel & Word Product Bulk Import Guide (Restricted to `react@mail`)

Only users signed in as **`react@mail`** can view the Bulk Import interface or call the import endpoints. Direct URL access or calls by other accounts are rejected with `HTTP 403 Forbidden`.

### Example Templates Location:
The official Word and Excel example template files are stored directly in the `plan/` folder:
- **Word Document:** [`D:\tempA\reactfull\plan\apex_books_template.docx`](file:///D:/tempA/reactfull/plan/apex_books_template.docx) (also at `D:\plan\apex_books_template.docx`)
- **Excel Spreadsheet:** [`D:\tempA\reactfull\plan\apex_books_template.xlsx`](file:///D:/tempA/reactfull/plan/apex_books_template.xlsx) (also at `D:\plan\apex_books_template.xlsx`)

### Option 1: Via the Web Interface (UI)
1. Open **`http://localhost:5173`**.
2. Click **Sign In** and log in as **`react@mail`** (password: `react123`).
3. The **`📥 Excel / Word 匯入 (Import Excel / Word)`** button will appear in the top navigation bar and above the Book Catalog.
4. Click the button to open the modal:
   - Click **Excel (.xlsx)** or **Word (.docx)** to download your preferred template.
   - Select your filled `.xlsx` or `.docx` file and click **Start Bulk Import**.
   - View live import statistics (inserted, updated, errors) and watch the catalog auto-refresh immediately!

### Option 2: Via the Terminal (CLI)
You can also run imports directly from PowerShell:
```powershell
cd D:\tempA\reactfull\backend
.\.venv\Scripts\Activate.ps1

# 1. Word Document (.docx) Import & Template Generation:
python import_word.py --template my_books_template.docx
python import_word.py ..\plan\apex_books_template.docx

# 2. Excel Spreadsheet (.xlsx) Import & Template Generation:
python import_excel.py --template my_books_template.xlsx
python import_excel.py ..\plan\apex_books_template.xlsx
```

---

## 🛠️ Handy Commands (When Needed)

### How to Stop the Servers:
- Click into the terminal running the server and press **`Ctrl + C`**.

### How to Reset / Re-seed Database with Books & Promos:
If you ever want to reset your database with fresh sample data:
```powershell
cd D:\tempA\reactfull\backend
.\.venv\Scripts\Activate.ps1
python seed.py
```

### Adding New Packages Later:
- **Backend (Python):**
  ```powershell
  cd D:\tempA\reactfull\backend
  pip install <package-name>
  pip freeze > requirements.txt
  ```
- **Frontend (Node/React):**
  ```powershell
  cd D:\tempA\reactfull\frontend
  npm install <package-name>
  ```

---

## ❓ Troubleshooting

1. **"Database connection failed" on backend startup:**
   - Make sure your PostgreSQL Windows Service is running.
   - Check [backend/.env](file:///d:/tempA/reactfull/backend/.env) to ensure `DATABASE_URL` has your correct password.

2. **"Port 8000 or 5173 is already in use":**
   - Check if you have an old terminal window still running in the background. Close it or press `Ctrl + C`.

3. **PowerShell blocks script activation (`Activate.ps1`):**
   - Run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
