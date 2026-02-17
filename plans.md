# P# Alibaba Clone Project Plan (React + Netlify Edition)

## Overview
- Project Name: AlibabaClone
- Stack: React 18 (with Vite), TypeScript, Tailwind CSS, React Router, Prisma + PostgreSQL (client-side queries via APIs), JWT for authentication, Stripe for payments, Netlify Functions for backend APIs
- Goal: E-commerce platform mimicking Alibaba with buyer/seller features, product search, carts, payments. Frontend in React, backend via serverless Netlify Functions.
- Deployment: Optimized for Netlify – static React build + functions. Use netlify.toml for config.
- Phases: Setup > DB/Models > Frontend UI > Backend APIs (Functions) > Advanced Features > Testing/Deploy

## Phase 1: Project Setup
- Create React app: npm create vite@latest . -- --template react-ts
- Install deps: npm i tailwindcss postcss autoprefixer react-router-dom axios @prisma/client jsonwebtoken stripe @stripe/react-stripe-js @stripe/stripe-js algoliasearch
- Init Tailwind: npx tailwindcss init -p
- Init Prisma: npx prisma init
- Set up Netlify Functions: npm i -D netlify-cli; mkdir netlify/functions
- Set up .env: VITE_DATABASE_URL, VITE_JWT_SECRET, VITE_STRIPE_PUBLISHABLE_KEY, etc. (use Vite's import.meta.env for frontend access)
- Files to generate:
  - src/main.tsx (root with Router)
  - src/App.tsx (main app with routes)
  - src/components/Header.tsx (search bar, nav, auth links)
  - src/components/Footer.tsx
  - netlify.toml: [build] command = "npm run build", publish = "dist"; [[redirects]] from = "/api/*" to = "/.netlify/functions/:splat" 200!

## Phase 2: Database Schema (prisma/schema.prisma) ✅ DONE
- **Prisma v7** setup: `prisma-client` generator with `output = "./generated/prisma"`, `prisma.config.ts` for CLI config
- **Driver**: `@prisma/adapter-pg` (PrismaPg) — required in v7 for PostgreSQL
- Models (9 total):
  - **User**: id, email, password (bcrypt hash), name, role (BUYER/SELLER/ADMIN), phone?, avatar?, bio?, company?, timestamps
  - **Address**: id, userId, label, street, city, state, postalCode, country, isDefault (cascade delete from User)
  - **Product**: id, name, slug (unique), description, price, compareAt?, images[], stock, minOrder, sku?, tags[], published, sellerId, categoryId, timestamps
  - **Category**: id, name (unique), slug (unique), image?, parentId (self-relation for hierarchy), timestamps
  - **Order**: id, buyerId, total, status (PENDING/PAID/SHIPPED/DELIVERED/CANCELLED), shippingAddress (JSON), paymentIntentId?
  - **OrderItem**: id, orderId, productId, quantity, price (cascade delete from Order)
  - **Cart**: id, userId (unique), updatedAt (cascade delete from User)
  - **CartItem**: id, cartId, productId, quantity — unique constraint on [cartId, productId] (cascade delete from Cart)
  - **Review**: id, productId, userId, rating, comment? — unique constraint on [productId, userId]
- DB setup steps:
  1. Set `DATABASE_URL` in `.env` (e.g. Supabase, Neon, or local PostgreSQL)
  2. `npx prisma generate` — generates client to `prisma/generated/prisma/`
  3. `npx prisma db push` — pushes schema to DB (or use `prisma migrate dev` for migration history)
  4. Shared client: `netlify/functions/lib/prisma.ts` uses `PrismaPg` adapter

## Phase 2b: Netlify Functions — DB API Endpoints ✅ DONE
- **Shared libs** (`netlify/functions/lib/`):
  - `prisma.ts` — singleton PrismaClient with PrismaPg adapter
  - `auth.ts` — JWT sign/verify, header parsing, CORS helpers, jsonResponse utility
- **Auth endpoints**:
  - `POST /api/auth-login` — email/password → bcrypt verify → JWT token
  - `POST /api/auth-register` — create user with hashed password, role validation, duplicate check
- **Products CRUD** (`/api/products`):
  - `GET` — list with pagination, search, category/price/seller filters, sorting
  - `GET ?id=` or `?slug=` — single product with reviews/seller/category
  - `POST` — create (seller/admin only, auto-generates slug)
  - `PUT ?id=` — update (owner/admin only, partial updates)
  - `DELETE ?id=` — delete (owner/admin only)
- **Categories CRUD** (`/api/categories`):
  - `GET` — list all (optionally `?topLevel=true`), includes children + product counts
  - `GET ?id=` or `?slug=` — single with parent/children
  - `POST/PUT/DELETE` — admin only, prevents delete if has children or products
- **Orders** (`/api/orders`):
  - `GET` — list own orders (buyer), orders containing seller's products (seller), all (admin)
  - `GET ?id=` — single order with items + product details
  - `POST` — create from cart items, validates stock, decrements stock, clears cart (transactional)
  - `PUT ?id=` — update status (seller/admin; buyer can only cancel)
- **Cart** (`/api/cart`):
  - `GET` — get cart with enriched product details
  - `POST` — add item (validates stock, upserts)
  - `PUT` — update item quantity (0 removes)
  - `DELETE ?productId=` — remove item; `DELETE` — clear cart
- **Users/Profile** (`/api/users`):
  - `GET` — own profile (with addresses); `GET ?id=` — public profile
  - `PUT` — update profile fields, password change with current password verification
  - `POST {action: "add-address"}` — add shipping address
  - `POST {action: "delete-address"}` — remove address

## Phase 3: Authentication ✅ DONE
- JWT-based auth with bcrypt password hashing
- `POST /api/auth-login` — verifies password, returns JWT + user object
- `POST /api/auth-register` — creates user with hashed password, validates role, checks duplicates
- Frontend `AuthContext` — stores token/user in localStorage, Axios interceptors for auth headers
- `PrivateRoute` component — protects routes by auth status + optional role check
- Role-based access: BUYER, SELLER, ADMIN

## Phase 4: Core Features ✅ DONE
All pages now fetch from real API (no more sample data):
- **HomePage** — fetches products via API with pagination, search, category/price filters, sorting, skeleton loading states
- **ProductPage** (`/products/:id`) — fetches product with reviews/seller info, image carousel, working add-to-cart/buy-now, review submission form
- **CartPage** — fetches cart from API, real-time quantity updates, remove items, links to checkout
- **CheckoutPage** (`/checkout`) — shipping address form, Stripe or direct payment, creates order
- **OrdersPage** — fetches orders from API, status filter, cancel order support
- **SellerDashboard** — fetches seller's products/orders/stats from API, working add product form with real categories, delete products
- **WishlistPage** (`/wishlist`) — view saved products, add to cart, remove from wishlist
- **Reviews** (`/api/reviews`) — create/update/delete reviews on product pages, star rating UI

## Phase 4b: Stripe Payment Integration ✅ DONE
- **Checkout Function** (`/api/checkout`):
  - Creates Stripe Checkout Session with line items from cart
  - Creates PENDING order in DB, stores `paymentIntentId`
  - Returns Stripe session URL for redirect
- **Webhook Handler** (`/api/stripe-webhook`):
  - Verifies Stripe signature
  - On `checkout.session.completed`: updates order to PAID, decrements stock, clears cart (transactional)
  - Handles `payment_intent.payment_failed`
- **CheckoutPage** — dual mode: Stripe card payment or direct order (pay later)
- **Environment variables needed**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`

## Phase 4c: Wishlist Feature ✅ DONE
- Prisma models: `Wishlist` + `WishlistItem` (unique constraint on [wishlistId, productId])
- **API** (`/api/wishlist`): GET (with product details), POST (add), DELETE (remove)
- **WishlistPage** — grid view with add-to-cart, remove, stock status
- **Header** — wishlist link with heart icon for authenticated users

## Phase 5: Advanced & Polish ✅ DONE
- **i18n** — basic English/Chinese support via React Context (`src/lib/i18n.tsx`)
  - Language switcher in Header top bar (EN/中文 toggle)
  - Translation keys for nav, home, product, cart, orders, checkout, seller, footer
  - Locale persisted in localStorage
- **Loading states** — skeleton UI with `animate-pulse` on all pages
- **Error handling** — error banners with retry buttons on all API-driven pages
- **Production optimization** (`netlify.toml`):
  - Build: `npx prisma generate && npm run build`
  - Node 20, esbuild bundler for functions
  - Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
  - Asset caching: 1-year immutable cache for `/assets/*`
  - SPA fallback for React Router

## Deployment Notes
1. **Environment variables** — set these in Netlify UI (Site Settings > Environment):
   ```
   DATABASE_URL=postgresql://...     # PostgreSQL connection string (Supabase/Neon/etc.)
   JWT_SECRET=your-secret-key        # For signing JWT tokens
   STRIPE_SECRET_KEY=sk_...          # Stripe secret key
   STRIPE_WEBHOOK_SECRET=whsec_...   # Stripe webhook endpoint secret
   VITE_API_URL=                     # Leave empty for same-origin API calls
   VITE_STRIPE_PUBLISHABLE_KEY=pk_.. # Stripe publishable key (frontend)
   ```
2. **Database setup**:
   ```bash
   npx prisma db push    # Push schema to DB (or use prisma migrate deploy for migrations)
   ```
3. **Deploy**: Connect GitHub repo to Netlify, or run `netlify deploy --prod`
4. **Stripe webhook**: Set webhook URL to `https://your-site.netlify.app/api/stripe-webhook` in Stripe Dashboard
5. **Netlify function limits**: 10s execution, 1MB response — keep queries efficient

## Project Structure
```
ali-baba/
├── prisma/
│   ├── schema.prisma          # 11 models (User, Product, Category, Order, etc.)
│   └── generated/prisma/      # Auto-generated Prisma client
├── netlify/functions/
│   ├── lib/prisma.ts          # Shared PrismaClient singleton
│   ├── lib/auth.ts            # JWT + CORS helpers
│   ├── auth-login.ts          # POST /api/auth-login
│   ├── auth-register.ts       # POST /api/auth-register
│   ├── products.ts            # CRUD /api/products
│   ├── categories.ts          # CRUD /api/categories
│   ├── orders.ts              # CRUD /api/orders
│   ├── cart.ts                # CRUD /api/cart
│   ├── users.ts               # Profile/address /api/users
│   ├── reviews.ts             # CRUD /api/reviews
│   ├── wishlist.ts            # CRUD /api/wishlist
│   ├── checkout.ts            # Stripe checkout /api/checkout
│   └── stripe-webhook.ts      # Stripe webhook /api/stripe-webhook
├── src/
│   ├── lib/api.ts             # Axios client + typed API methods
│   ├── lib/i18n.tsx           # i18n context (en/zh)
│   ├── context/AuthContext.tsx # Auth state management
│   ├── components/            # Header, Footer, ProductCard, PrivateRoute
│   └── pages/                 # Home, Product, Login, Register, Cart, Checkout, Orders, Seller, Wishlist
├── netlify.toml               # Build + deploy config
├── prisma.config.ts           # Prisma v7 CLI config
└── package.json
```

