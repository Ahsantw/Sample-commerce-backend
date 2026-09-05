# Sample Commerce Backend

A Node.js/Express REST API backend for an e-commerce store, with JWT authentication, product/category management, cart, orders, image uploads, a customer-support chat, and homepage sliders — backed by MongoDB (Mongoose).

## Features

- **Authentication** — signup/login with JWT, bcrypt-hashed passwords, `buyer`/`admin` roles, and an auto-created default admin account.
- **Products & Categories** — full CRUD for products (with image upload) and categories, plus a featured-products endpoint.
- **Cart** — per-user cart with add/update/remove items, item count, and an auto-calculated total.
- **Orders** — place orders, view own order history, admin order listing/status updates/cancellation, order stats overview, and a scheduled cleanup job that purges old cancelled orders.
- **Chat / Support messaging** — logged-in user ↔ admin conversations, plus a guest (non-logged-in) contact-form/chat flow, with messages auto-expiring after 7 days (MongoDB TTL index).
- **Homepage sliders** — admin-managed promotional sliders (image, title, button link, ordering, active/inactive).
- **File uploads** — product and slider images served statically from `/uploads`.
- **Scheduled maintenance** — a daily cron job (2 AM) cleans up old cancelled orders.

## Tech Stack

- **Runtime**: Node.js + Express 4
- **Database**: MongoDB via Mongoose 7
- **Auth**: JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` for password hashing
- **File uploads**: `multer`
- **Scheduling**: `node-cron`
- **Other**: `cors`, `dotenv`

## Project Structure

```
Sample-commerce-backend/
├── server.js                  # App entry point — Express setup, routes, MongoDB connection, cron job
├── middleware/
│   └── auth.js                 # `auth` (JWT verification) and `adminAuth` (role check) middleware
├── models/
│   ├── User.js                 # Users (username, email, password hash, role) + default admin seeding
│   ├── Product.js              # Products (name, description, price, image, category, stock, featured)
│   ├── Category.js             # Product categories
│   ├── Cart.js                 # Per-user cart with items and auto-calculated total
│   ├── Order.js                # Orders with items, shipping address, status, payment status/method
│   ├── Slider.js                # Homepage promotional sliders
│   └── Chat.js / Message.js    # Chat/contact messages (TTL: auto-deleted after 7 days)
├── routes/
│   ├── auth.js                 # /api/auth — login, signup, me, logout
│   ├── users.js                 # /api/users — admin user listing/deletion
│   ├── products.js              # /api/products — CRUD, featured, categories
│   ├── categories.js            # /api/categories — CRUD
│   ├── cart.js                   # /api/cart — view/add/update/remove/clear/count
│   ├── orders.js                 # /api/orders — place, list, status, cancel, stats, cleanup
│   ├── chat.js                   # /api/chat — conversations, messages, guest chat
│   └── sliders.js                # /api/sliders — CRUD, active sliders, reordering
├── scripts/
│   └── cleanupOrders.js          # Deletes cancelled orders older than 7 days (used by the cron job, also runnable standalone)
└── uploads/
    ├── products/                 # Uploaded product images
    └── sliders/                  # Uploaded slider images
```

## API Overview

| Route prefix | Endpoints |
|---|---|
| `/api/auth` | `POST /login`, `POST /signup`, `GET /me` (auth), `POST /logout` (auth) |
| `/api/users` | `GET /` (admin), `DELETE /:id` (admin) |
| `/api/products` | `GET /`, `GET /featured`, `GET /:id`, `POST /` (admin, image upload), `PUT /:id` (admin, image upload), `DELETE /:id` (admin), `GET /categories/all`, `POST /categories` (admin) |
| `/api/categories` | `GET /`, `GET /:id`, `POST /` (admin), `PUT /:id` (admin), `DELETE /:id` (admin) |
| `/api/cart` | `GET /` (auth), `POST /items` (auth), `PUT /items/:productId` (auth), `DELETE /items/:productId` (auth), `DELETE /clear` (auth), `GET /count` (auth) |
| `/api/orders` | `POST /` (auth), `GET /my-orders` (auth), `GET /` (admin), `GET /:id` (auth), `PATCH /:id/status` (admin), `PATCH /:id/cancel` (auth), `PATCH /:id/admin-cancel` (admin), `GET /stats/overview` (admin), `DELETE /cleanup` (admin) |
| `/api/chat` | `GET /conversations` (admin), `GET /conversation/:conversationId` (auth), `POST /message` (auth), `POST /guest-message`, `GET /guest-conversation/:email`, `DELETE /conversation/:conversationId` (admin) |
| `/api/sliders` | `GET /`, `GET /active`, `POST /` (admin, image upload), `PUT /:id` (admin, image upload), `DELETE /:id` (admin), `PATCH /:id/order` (admin) |
| `/api/test` | `GET /` — simple health check |

`(auth)` = requires a valid JWT (any logged-in user). `(admin)` = requires a valid JWT **and** `role: admin`.

## Requirements

- Node.js (LTS recommended)
- A running MongoDB instance (local or hosted, e.g., MongoDB Atlas)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root with:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/shopdb
   JWT_SECRET=your-secret-key
   ```
   (If `MONGODB_URI`/`JWT_SECRET` are not set, the app falls back to `mongodb://localhost:27017/shopdb` and a default JWT secret — **do not rely on the default secret in production**.)
3. Start the server:
   ```bash
   npm start
   ```
   or, for auto-reload during development:
   ```bash
   npm run dev
   ```
4. On startup, the app connects to MongoDB and listens on the configured port (default `5000`). A default admin account should be created via `User.initAdmin()` — call this once (e.g., on app startup or via a setup script) if it isn't already invoked automatically, using the seeded credentials `username: admin`, `password: admin1234`. **Change this password immediately in any real deployment.**

## Usage Notes

- **CORS**: preconfigured to allow `http://localhost:8080`, `http://127.0.0.1:8080`, `http://localhost:3000`, and `http://127.0.0.1:3000` — update the allowed origins in `server.js` for your frontend's actual URL(s).
- **File uploads**: product and slider images are uploaded via `multipart/form-data` (using `multer`) and served statically at `/uploads/products/...` and `/uploads/sliders/...`.
- **Order cleanup**: a cron job runs daily at 2 AM to permanently delete orders that have been `cancelled` for more than 7 days. This can also be triggered manually by running:
  ```bash
  node scripts/cleanupOrders.js
  ```
- **Chat message retention**: chat/contact messages are automatically deleted by MongoDB after 7 days via a TTL index — this is not app-level logic and applies regardless of how the API is used.

## License

This project is licensed under the **MIT License** — see [`LICENSE`](./LICENSE) for details.
