# Global Theme & Multi-Language Architecture (Bookstore Edition)
**Document Date:** November 19, 2026  
**File Location:** `D:\react_20261119_themeLanguage.md`  
**Target Project:** `D:\tempA\reactfull`  
**Stack:** React 19 (TypeScript + Vite) • FastAPI • PostgreSQL 16 (SQLAlchemy + Psycopg)

---

## 1. Executive Summary: Was It Too Late to Switch to a Bookstore?

**No, it is never too late!** In modern full-stack development, transitioning domain entities (e.g., from *Dishes/Restaurant* to *Books/Bookstore*) is clean and straightforward when you have clear boundaries:
- The **Data Layer (`C00_`)** simply updates its column semantics (e.g., `ingredients` becomes `isbn`, `calories` becomes `page_count`, `category` becomes `genre`).
- The **API Layer (FastAPI)** serves the new book models and serializes bilingual fields.
- The **UI Layer (React)** uses reusable layouts (hero, promo cards, recommended grid, catalog filter, detail modal, cart, chatbox).

Everything has now been converted into **Apex Book Haven (文萃讀坊)**!

---

## 2. Global Dark / Light Theme Architecture

### 2.1 How It Works Across the Entire Website
Instead of hardcoding color hex codes inside components, the system uses **CSS Custom Properties (Variables)** keyed to a `data-theme` attribute on the HTML root element (`<html data-theme="dark">`).

```
+-------------------------------------------------------------+
|                     User clicks ☀️ / 🌙                     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|       ThemeProvider (`src/contexts/ThemeContext.tsx`)        |
|  - Updates React state (`theme: 'light' | 'dark'`)          |
|  - Sets `document.documentElement.setAttribute('data-theme')|
|  - Persists preference in `localStorage.setItem('app_theme')|
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|           CSS Variables (`src/styles/theme.css`)            |
|  :root / [data-theme="light"]        [data-theme="dark"]    |
|  --bg-primary: #ffffff;              --bg-primary: #0b1120; |
|  --text-primary: #0f172a;            --text-primary: #f8fafc|
|  --bg-card: #ffffff;                 --bg-card: #1e293b;    |
|  --border-color: #e2e8f0;            --border-color: #334155|
|  --accent: #ea580c;                  --accent: #f97316;     |
+-------------------------------------------------------------+
```

### 2.2 How to Use the Theme on Any Future Page
Any new component or page you build automatically adapts to Dark/Light mode simply by using CSS variables:

```tsx
// Example: Creating a new page or card in the future
export function BookReviewCard() {
  return (
    <div style={{
      background: "var(--bg-card)",        // white in light mode, dark navy in dark mode
      color: "var(--text-primary)",         // dark text in light mode, light text in dark mode
      border: "1px solid var(--border-color)",
      padding: 16,
      borderRadius: 12
    }}>
      <h3>Review Title</h3>
    </div>
  );
}
```

Or, if your component needs the raw theme string for logic:
```tsx
import { useTheme } from "./contexts/ThemeContext";

const { theme, toggleTheme } = useTheme();
console.log(theme); // "light" or "dark"
```

---

## 3. Global Multi-Language (i18n) Architecture

### 3.1 Two Types of Text in Full-Stack Apps
A production application has two categories of text:
1. **Static UI Chrome:** Button labels, navigation titles, modal headers, error messages, footer notices.
2. **Dynamic Database Content:** Book titles, authors, synopsis, bookstore opening hours, promotion headlines.

We solved both cleanly and seamlessly:

#### A. Static UI Strings (Type-Safe Dictionary Pattern)
- Located in `src/locales/`:
  - `en.ts`: English dictionary.
  - `zhTW.ts`: Traditional Chinese dictionary (`typeof en` ensures 100% type safety — TypeScript will warn you if any translation key is missing!).
  - `index.ts`: Registry mapping language codes to dictionaries.
- Accessible everywhere via `const { t } = useLanguage()`:
  ```tsx
  <button>{t("btn_add_cart")}</button>
  // Outputs "+ Add to Bag" in English, or "+ 放入購書袋" in Traditional Chinese!
  ```

#### B. Dynamic Database Content (Dual-Language Columns + Instant Client Switching)
In the database, content tables store both English and Traditional Chinese fields:
- `title_en` and `title_zh`
- `author_en` and `author_zh`
- `short_desc_en` and `short_desc_zh`
- `full_synopsis_en` and `full_synopsis_zh`

The `useLanguage()` hook provides a helper:
```tsx
const { localize } = useLanguage();

// Automatically returns book.title_zh if active lang is 'zh-TW', else book.title_en
<h3>{localize(book, "title")}</h3>
<p>{localize(book, "author")}</p>
```
**Advantage:** When the user clicks the language toggle, the entire page updates **instantly in 0 milliseconds** without making a slow network request to the backend.

### 3.2 How to Add a 3rd Language (e.g., Japanese or Spanish) in 2 Minutes
1. Create `src/locales/ja.ts` (copy `en.ts` and translate the values).
2. In `src/locales/index.ts`, add:
   ```ts
   import { ja } from "./ja";
   export const dictionaries = { en, "zh-TW": zhTW, ja };
   export const languageNames = { en: "English", "zh-TW": "繁體中文", ja: "日本語" };
   ```
3. Done! The language switcher automatically supports the new language.

---

## 4. Bookstore Database Schema Arrangement

All tables follow your naming convention:
- **`S00_`** System / Authentication
- **`C00_`** Configuration / Bookstore Catalog / Orders

### 4.1 System Tables (`S00_`)
- **`S00_users`**: `id`, `email`, `hashed_password` (Argon2), `created_at`.
- **`S00_roles`**: `id`, `name` (`customer`, `admin`, `staff`).

### 4.2 Bookstore Tables (`C00_`)

#### `C00_site_settings`
| Column | Type | Description |
| :--- | :--- | :--- |
| `store_name_en` / `store_name_zh` | String(100) | Apex Book Haven / 文萃讀坊 |
| `hero_title_en` / `hero_title_zh` | String(255) | Main hero headlines in EN & ZH |
| `hero_subtitle_en` / `hero_subtitle_zh` | String(255) | Descriptive sub-headings |
| `about_text_en` / `about_text_zh` | Text | Full story & philosophy of the bookstore |
| `address_en` / `address_zh` | String(255) | Physical location |
| `phone`, `email` | String | Customer service contacts |
| `opening_hours_en` / `opening_hours_zh` | String(100) | Opening hours in EN & ZH |

#### `C00_promotions`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer PK | Promo ID |
| `title_en` / `title_zh` | String(100) | e.g. "Autumn Literary Festival" / "秋季讀書節" |
| `badge_en` / `badge_zh` | String(50) | e.g. "20% OFF" / "限時 8 折" |
| `discount_code` | String(50) | `READ20`, `EDUBOOK`, `WEEKEND` |
| `image_url` | String(500) | Promo banner photography |
| `is_active` | Boolean | Visibility |

#### `C00_categories` (Book Genres)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer PK | Category ID |
| `name_en` / `name_zh` | String(100) | Tech & Programming / 資訊與程式技術, Personal Growth / 心理與個人成長, Sci-Fi & Fantasy / 科幻與奇幻文學, World Literature / 世界經典文學, Design & Art / 藝術與設計思維 |
| `icon` | String(50) | `💻`, `🌱`, `🚀`, `📖`, `🎨` |
| `sort_order` | Integer | Order on tab bar |

#### `C00_products` (Books)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer PK | Book ID |
| `category_id` | Integer FK | Linked Genre (`C00_categories.id`) |
| `title_en` / `title_zh` | String(150) | Atomic Habits, Clean Code, Dune, Little Prince, Sapiens... |
| `author_en` / `author_zh` | String(100) | James Clear, Uncle Bob, Frank Herbert, Antoine de Saint-Exupéry... |
| `short_desc_en` / `short_desc_zh`| String(300) | Card summary |
| `price` | Float | Unit price ($USD) |
| `image_url` | String(500) | High-res cover photography |
| `is_recommended` | Boolean | Staff Recommended flag |

#### `C00_prod_details` (Book Specifications)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer PK | Detail ID |
| `product_id` | Integer FK (1:1) | Linked book (`C00_products.id`) |
| `full_synopsis_en` / `full_synopsis_zh` | Text | Full in-depth literary synopsis |
| `publisher_en` / `publisher_zh` | String(100) | Publisher (e.g. Avery, Prentice Hall, Ace Books) |
| `isbn` | String(50) | International Standard Book Number (e.g. 978-0735211292) |
| `publication_year` | Integer | Year published |
| `page_count` | Integer | Total pages (e.g. 320, 464, 688) |
| `format_en` / `format_zh` | String(50) | Hardcover, Paperback, Collector Foil |

#### `C00_orders` & `C00_order_items`
- Store customer book purchases, item quantities, price snapshots, and fulfillment status.

---

## 5. File Inventory & Structural Map

```text
D:\tempA\reactfull\
├── backend/
│   ├── .env                       # DB credentials & JWT secret
│   ├── requirements.txt           # Python dependencies
│   ├── seed.py                    # Recreates & seeds bookstore catalog
│   └── app/
│       ├── __init__.py
│       ├── auth.py                # Argon2 password hashing & PyJWT tokens
│       ├── database.py            # SQLAlchemy PostgreSQL connection
│       ├── models.py              # S00_ and C00_ ORM models with bilingual columns
│       ├── schemas.py             # Pydantic schemas for bookstore API
│       └── main.py                # FastAPI routes & CORS
│
└── frontend/
    ├── .env                       # VITE_API_URL=http://localhost:8000
    └── src/
        ├── contexts/
        │   ├── ThemeContext.tsx    # Global Light/Dark theme provider & useTheme()
        │   └── LanguageContext.tsx # Global i18n language provider & useLanguage()
        ├── locales/
        │   ├── en.ts              # English string dictionary
        │   ├── zhTW.ts            # Traditional Chinese string dictionary
        │   └── index.ts           # Language registry
        ├── styles/
        │   └── theme.css          # Design tokens & CSS variables for light/dark
        ├── App.tsx                # Bookstore Homepage with Theme/Lang toggles
        └── main.tsx               # Root entry wrapped with Theme & Lang Providers
```

---

## 6. Verification & How to Run

1. **Backend:**
   ```powershell
   cd D:\tempA\reactfull\backend
   .\.venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload
   ```
2. **Frontend:**
   ```powershell
   cd D:\tempA\reactfull\frontend
   npm run dev
   ```
3. Open **`http://localhost:5173`**:
   - Click **☀️ / 🌙** in the top bar to watch the entire UI smoothly transition between **Dark Mode** and **Light Mode**.
   - Click **🌐 English / 繁體中文** to watch all UI labels **and all book titles, authors, and synopsis** switch languages in real time.
   - Click **"Book Details"** on any title to inspect publisher, ISBN, page count, and format.
   - Click **"+ Add to Bag"** and test placing an order via the Slide-out Drawer!
