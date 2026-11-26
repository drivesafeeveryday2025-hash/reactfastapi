# Full-Stack Restaurant Ordering System — Startup & Implementation Plan
**Document Date:** November 19, 2026  
**Project Path:** `D:\tempA\reactfull`  
**Technology Stack:** React (TypeScript + Vite) + FastAPI (Python 3.13) + PostgreSQL 16 (psycopg / SQLAlchemy)

---

## 1. System Architecture Overview

This project is a decoupled full-stack architecture where the React frontend talks to a FastAPI REST API via HTTP/JSON, and FastAPI handles authentication, database logic, and data persistence in PostgreSQL.

```
+-------------------------------------------------------------+
|                     Browser (Client)                        |
|   React (Vite + TypeScript) @ http://localhost:5173         |
|   - Hero / Introduce Section                                |
|   - Promotions Carousel / Coupons                           |
|   - Recommended Products (Chef's Picks)                     |
|   - Dynamic Category Filter & Full Menu Order Grid          |
|   - Product Detail Modal (Ingredients, Calories, Allergens) |
|   - Cart Drawer & Order Checkout                            |
|   - About Us & Contact Info                                 |
|   - Floating Support Chatbox (Toggle Open / Close)          |
+------------------------------+------------------------------+
                               |
                               | HTTP / JSON (Bearer JWT Auth)
                               v
+-------------------------------------------------------------+
|                     FastAPI Backend                         |
|   Python 3.13 + Uvicorn @ http://localhost:8000             |
|   - CORS Middleware for React                               |
|   - Password Hashing (Argon2) & PyJWT Token Security        |
|   - Interactive API Documentation @ /docs                   |
+------------------------------+------------------------------+
                               |
                               | SQLAlchemy ORM + Psycopg
                               v
+-------------------------------------------------------------+
|                  PostgreSQL Database                        |
|   Port 5432 / Database: `appdb`                             |
|   - S00_ System & User Tables                               |
|   - C00_ Restaurant Catalog & Configuration Tables          |
+-------------------------------------------------------------+
```

---

## 2. PostgreSQL Database Schema Arrangement

All tables follow your naming convention:
- **`S00_`** prefix: System, authentication, roles, and user accounts.
- **`C00_`** prefix: Configuration, restaurant content, product catalog, details, and orders.

### 2.1 System Tables (`S00_`)

#### `S00_roles`
Stores authorization roles within the application.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Unique role ID |
| `name` | String(50) | Unique | Role name (`customer`, `admin`, `staff`) |

#### `S00_users`
Stores user authentication credentials.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Unique user ID |
| `email` | String(255) | Unique, Index | User email address (login credential) |
| `hashed_password` | String(255) | Not Null | Argon2 / PBKDF2 secure hashed password |
| `created_at` | DateTime | Default UTC | Timestamp of account registration |

---

### 2.2 Content & Catalog Tables (`C00_`)

#### `C00_site_settings`
Controls the homepage brand name, hero banner content, and contact info directly from the database.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Single-row config ID |
| `restaurant_name` | String(100) | Default | Restaurant brand display name |
| `hero_title` | String(255) | Not Null | Main headline on the homepage |
| `hero_subtitle` | String(255) | Not Null | Sub-headline under the hero title |
| `about_text` | Text | Not Null | Full paragraph for the "About Us" story |
| `address` | String(255) | Not Null | Physical restaurant address |
| `phone` | String(50) | Not Null | Contact / reservation phone |
| `email` | String(100) | Not Null | Support / business email |
| `opening_hours` | String(100) | Not Null | Weekly schedule (e.g. Mon-Sun: 11:30 AM - 10:00 PM) |

#### `C00_promotions`
Stores promotional discount banners displayed below the hero.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Promotion ID |
| `title` | String(100) | Not Null | Promotion title |
| `badge` | String(50) | Not Null | Badge tag (e.g., `20% OFF`, `FREE DRINK`) |
| `discount_code` | String(50) | Not Null | Promo voucher code (e.g., `TASTE20`) |
| `image_url` | String(500) | Not Null | Banner photography image URL |
| `is_active` | Boolean | Default True | Controls promo visibility |

#### `C00_categories`
Stores menu category tabs.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Category ID |
| `name` | String(100) | Unique | Category name (`Artisan Pizza`, `Handmade Pasta`, etc.) |
| `icon` | String(50) | Not Null | Emoji/Icon (e.g. `🍕`, `🍝`, `🥗`, `🍰`, `🍹`) |
| `sort_order` | Integer | Default 0 | Sequence on the homepage menu bar |
| `is_active` | Boolean | Default True | Category visibility |

#### `C00_products`
The core catalog item table.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Product ID |
| `category_id` | Integer | Foreign Key (`C00_categories.id`) | Linked menu category |
| `name` | String(150) | Index, Not Null | Dish name |
| `short_desc` | String(255) | Not Null | Brief preview description for the card |
| `price` | Float | Not Null | Unit price in USD |
| `image_url` | String(500) | Not Null | Food photography URL |
| `is_recommended`| Boolean | Default False | Flags item for the "Chef's Recommendations" section |
| `is_active` | Boolean | Default True | Product visibility |

#### `C00_prod_details`
1-to-1 extension table holding in-depth specifications for each product.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Detail ID |
| `product_id` | Integer | Foreign Key (`C00_products.id`), Unique | 1-to-1 link to `C00_products` |
| `full_description`| Text | Not Null | Complete chef explanation of recipe |
| `ingredients` | String(500) | Not Null | Full ingredients list |
| `calories` | Integer | Default 0 | Caloric count per serving |
| `allergens` | String(255) | Default 'None' | Allergen declaration (Gluten, Dairy, Nuts, etc.) |
| `spice_level` | Integer | Default 0 | Heat index (0 = Mild, 1 = Medium, 2 = Spicy) |
| `is_vegetarian` | Boolean | Default False | Dietary badge indicator |

#### `C00_orders`
Stores customer orders placed from the website.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Order ID |
| `user_id` | Integer | Foreign Key (`S00_users.id`) | Customer who submitted the order |
| `total_amount` | Float | Default 0.0 | Total order price |
| `status` | String(50) | Default 'received' | Order status (`received`, `cooking`, `delivered`) |
| `created_at` | DateTime | Default UTC | Order timestamp |

#### `C00_order_items`
Line items belonging to an order.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Item ID |
| `order_id` | Integer | Foreign Key (`C00_orders.id`) | Linked order |
| `product_id` | Integer | Foreign Key (`C00_products.id`) | Linked product |
| `quantity` | Integer | Default 1 | Number of portions ordered |
| `unit_price` | Float | Not Null | Snapshot price at time of purchase |

---

## 3. Files Created & Updated

### 3.1 Backend Files (`D:\tempA\reactfull\backend`)

| File Path | Purpose |
| :--- | :--- |
| **`app/models.py`** | Defines SQLAlchemy database models for all `S00_` and `C00_` tables, foreign keys, and relationships. |
| **`app/schemas.py`** | Defines Pydantic data schemas for request validation and serialization (Auth, Site Settings, Promotions, Categories, Products with Details, and Orders). |
| **`app/main.py`** | FastAPI application exposing CORS, auth routes (`/api/register`, `/api/login`, `/api/me`), content endpoints (`/api/settings`, `/api/promotions`, `/api/categories`, `/api/products`), and order submission (`/api/orders`). |
| **`app/auth.py`** | Implements Argon2 password hashing verification and PyJWT token generation & decoding. |
| **`app/database.py`**| Creates the SQLAlchemy engine, session maker, and database dependency for PostgreSQL. |
| **`seed.py`** | One-click initialization script that populates realistic sample data (Italian pizzas, pastas, desserts, promos, and settings) directly into PostgreSQL. |
| **`.env`** | Stores `DATABASE_URL` and `SECRET_KEY` securely outside Git. |

### 3.2 Frontend Files (`D:\tempA\reactfull\frontend`)

| File Path | Purpose |
| :--- | :--- |
| **`src/App.tsx`** | Single, cohesive, responsive React application containing: <br>• User Login / Registration form with error states.<br>• Sticky Top Navbar with Cart badge & Logout.<br>• **1. Introduce / Hero Section** with Tuscany tagline and quick highlights.<br>• **2. Promotion Section** with coupon codes and copy buttons.<br>• **3. Recommended Section** highlighting Chef Marco's picks.<br>• **4. Full Menu Section** with dynamic Category tabs filter & "+ Add to Cart".<br>• **5. About Us Section** rendering history from the database.<br>• **6. Contact Us Section** showing address, phone, and hours.<br>• **Product Detail Modal** popup displaying ingredients, calories, and allergens.<br>• **Slide-out Cart Drawer** with quantity controls and real-time total calculation.<br>• **Floating Support Chatbox** in bottom-right corner with open/close toggle and automated replies. |
| **`.env`** | Sets `VITE_API_URL=http://localhost:8000` to connect React to the FastAPI backend. |

---

## 4. How Everything Runs Together

### Daily Start Commands:
Open two terminals in VS Code:

1. **Terminal 1 (Backend):**
   ```powershell
   cd D:\tempA\reactfull\backend
   .\.venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload
   ```
2. **Terminal 2 (Frontend):**
   ```powershell
   cd D:\tempA\reactfull\frontend
   npm run dev
   ```

### Live URLs:
- **Frontend Restaurant Page:** `http://localhost:5173`
- **FastAPI Interactive Docs (Swagger):** `http://localhost:8000/docs`
- **PostgreSQL Database:** View tables anytime via **pgAdmin 4** under `Servers -> PostgreSQL -> Databases -> appdb -> Schemas -> public -> Tables`.
