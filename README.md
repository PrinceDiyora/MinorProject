# RasoiAI

An AI-powered restaurant management platform that combines real-time dynamic pricing, intelligent upsell recommendations, and a voice-based ordering agent. Built for multi-tenant restaurant operations with a focus on margin optimization and operational efficiency.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Modules](#modules)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [ML Engines](#ml-engines)
- [Voice Agent (Riya)](#voice-agent-riya)
- [Database Schema](#database-schema)

---

## Overview

The platform addresses three core problems for restaurant operators:

1. **Dynamic Pricing** -- Automatically adjusts menu item prices based on demand patterns, time of day, competitor pricing, and margin constraints using trained XGBoost models.

2. **Upsell Intelligence** -- Predicts which additional items a customer is most likely to accept based on their current cart, synergy scores between item pairs, and historical acceptance rates.

3. **Voice Ordering** -- An AI phone agent named Riya takes orders over a phone call, validates items against the live database, offers intelligent upsells, and pushes completed orders directly into the system.

All three systems share the same PostgreSQL database and are fully multi-tenant. Each restaurant operator signs up independently and only accesses their own data.

---

## Architecture

```
Frontend (React + Vite)         Node.js Backend (Express)         PostgreSQL
      :5173            --->           :8000              --->     (Supabase)
                                        |
                          +-------------+-------------+
                          |             |             |
                    ML Service     SarvamAI (Voice)    Twilio
                    (Python)     (Gemini 2.5 Flash)  (Telephony)
                      :5000
```

- The **Frontend** communicates exclusively with the Node.js backend via REST.
- The **Backend** proxies ML inference requests to the Python ML Service.
- **SarvamAI** orchestrates voice calls. During a call, the LLM calls tools that hit the backend's `/api/voice/*` endpoints.
- **Twilio** provides the phone number and telephony layer.

---

## Modules

### Module 1 -- Authentication
JWT-based authentication with access and refresh tokens stored as HttpOnly cookies. Google OAuth supported. All downstream routes are protected by the `verifyAdminJWT` middleware, which attaches `req.admin.id` to every request.

### Module 2 -- Menu Management
Full CRUD for categories and food items. Each item tracks cost price, selling price, min/max price bounds, discount percentage, stock quantity, availability toggle, and a competitor price index. Database constraints enforce a minimum 20% margin floor (`min_price >= cost_price * 1.20`).

### Module 3 -- Order Management
Orders are created with line-item detail including upsell flags, discount percentages, and price snapshots at the time of order. Stock is decremented atomically. Order status follows a defined lifecycle: `pending`, `preparing`, `ready`, `delivered`, `cancelled`.

### Module 4 -- Dynamic Pricing (Engine 1)
An XGBoost regressor trained on 22 features (time signals, demand, competitor index, margin metrics) predicts an optimal selling price for each item. The prediction is clamped to the item's configured `[min_price, max_price]` range. Applied changes are recorded in a price history audit table.

### Module 5 -- Upsell Recommendation (Engine 2)
An XGBoost classifier trained on 33 features scores every potential upsell candidate against the current cart. Features include synergy scores, price ratios, margin signals, and time context. Recommendations are only surfaced if the predicted acceptance probability exceeds a configurable threshold (default 0.52). Discounts are synergy-proportional, capped at 15%.

### Module 6 -- Strategic Pricing (Engine 3)
A three-stage cascade: (A) should the price change, (B) increase or decrease, (C) by how much. Items are classified into BCG matrix quadrants (Stars, Plowhorses, Puzzles, Dogs) based on margin and popularity. Stars always get a price decrease to stimulate demand. Plowhorses always get an increase due to price inelasticity. Puzzles and Dogs are model-guided. Magnitude is rule-based, capped at 30%.

### Module 7 -- Voice Agent
A phone-based AI ordering agent. Starts every call in Hinglish and adapts to the caller's language. Uses seven tool calls to interact with the backend: session creation, category listing, menu browsing, item validation (fuzzy matching via Fuse.js), price lookup, upsell suggestion, and order placement. All order writes execute inside a single PostgreSQL transaction with full rollback on failure.

### Module 8 -- Dashboard UI
React-based admin interface with: live orders table, menu matrix with inline editing, price optimizer showing Engine 1 and Engine 3 suggestions with one-click apply, upsell panel with acceptance rates, voice settings configuration, admin profile management, and KPI metric cards.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router 7 |
| Backend | Node.js, Express 5, ES Modules |
| ML Service | Python 3, FastAPI, Uvicorn |
| ML Models | XGBoost, scikit-learn, pandas, NumPy |
| Database | PostgreSQL (hosted on Supabase) |
| Authentication | JWT (jsonwebtoken), bcrypt, Google OAuth |
| Voice AI | SarvamAI (orchestration), Gemini 2.5 Flash (LLM) |
| Telephony | Twilio |
| Fuzzy Matching | Fuse.js |
| Dev Tooling | nodemon, ESLint, dotenv |

---

## Project Structure

```
911-GT3-RS/
|-- Frontend/                    React application
|   |-- src/
|   |   |-- Components/
|   |   |   |-- Dashboard/       Dashboard views (14 components)
|   |   |   |-- LandingPage/     Marketing pages
|   |   |-- context/             React context providers
|   |   |-- services/            API client (Axios)
|   |   |-- main.jsx             Entry point and routing
|
|-- Node_Backend/                Express API server
|   |-- config/
|   |   |-- agentPrompt.js       Voice agent system prompt
|   |   |-- vapiToolSchemas.js   Tool definitions for Vapi
|   |-- scripts/
|   |   |-- createVapiAssistant.js
|   |   |-- linkPhoneNumber.js
|   |   |-- registerVapiTools.js
|   |   |-- triggerCall.js
|   |-- src/
|   |   |-- controllers/         Route handlers (9 controllers)
|   |   |-- db/                  Pool config, schema DDL, migrations
|   |   |-- middlewares/         JWT verification
|   |   |-- routers/             Express route definitions (9 routers)
|   |   |-- seeds/               Sample data seeders
|   |   |-- index.js             Server entry point
|   |   |-- app.js               Express app configuration
|
|-- ML_Service/                  Python ML inference server
|   |-- engines/                 Engine 1, 2, 3 inference logic
|   |-- models/                  Model loader
|   |-- routes/                  FastAPI route definitions
|   |-- schemas/                 Pydantic request/response schemas
|   |-- utils/                   Feature engineering utilities
|   |-- app.py                   FastAPI entry point
|   |-- config.py                Paths and business rule constants
|
|-- ML Models/                   Pre-trained model artifacts
|   |-- engine1_export/          XGBoost regressor + metadata
|   |-- engine2_export/          XGBoost classifier + synergy map + item lookup
|   |-- engine3_export/          XGBoost classifiers A, B + metadata
|
|-- DATABASE_SCHEMA.md           Full schema documentation
```

---

## Prerequisites

- Node.js >= 18
- Python >= 3.10
- PostgreSQL database (Supabase or local)
- Twilio account with a purchased phone number
- SarvamAI account with API key
- Gemini 2.5 Flash API key
- ngrok (for exposing local backend to Vapi during development)

---

## Environment Variables

Create `Node_Backend/.env` with the following:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Server
PORT=8000
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
NODE_ENV=development

# Authentication
GOOGLE_CLIENT_ID=<your-google-client-id>
JWT_ACCESS_SECRET=<random-secret-min-32-chars>
JWT_REFRESH_SECRET=<random-secret-min-32-chars>

# Twilio
TWILIO_API_KEY_SID=<your-twilio-api-key-sid>
TWILIO_API_KEY_SECRET=<your-twilio-api-key-secret>
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>

# Voice Agent
VAPI_API_KEY=<your-vapi-api-key>
VAPI_ASSISTANT_ID=<set-after-running-createVapiAssistant>
VAPI_PHONE_NUMBER_ID=<set-after-running-linkPhoneNumber>
SARVAM_API_KEY=<your-sarvam-api-key>
MY_PHONE_NUMBER=<personal-phone-for-test-calls>
BACKEND_PUBLIC_URL=<ngrok-https-url-no-trailing-slash>

# ML Service
ML_SERVICE_URL=http://localhost:5000

# Other
GEMINI_API_KEY=<your-gemini-api-key>
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/hrushi2501/911-GT3-RS.git
cd 911-GT3-RS
```

### 2. Install Node.js backend dependencies

```bash
cd Node_Backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../Frontend
npm install
```

### 4. Install Python ML Service dependencies

```bash
cd ../ML_Service
pip install -r requirements.txt
```

---

## Database Setup

### Initialize tables

```bash
cd Node_Backend
npm run db:init
```

This executes all CREATE TABLE statements from the schema definition.

### Run migrations (if upgrading)

```bash
npm run db:migrate
```

### Seed sample data

```bash
npm run seed
```

Individual seeders are also available:

```bash
npm run seed:categories
npm run seed:items
npm run seed:customers
npm run seed:orders
```

### Set admin password

```bash
npm run admin:set-password
```

---

## Running the Application

Open three separate terminals:

### Terminal 1 -- Node.js Backend

```bash
cd Node_Backend
npm run dev
```

Starts the Express server on port 8000 with hot reload via nodemon.

### Terminal 2 -- ML Service

```bash
cd ML_Service
python app.py
```

Starts the FastAPI server on port 5000. Loads all three XGBoost model sets on startup.

### Terminal 3 -- Frontend

```bash
cd Frontend
npm run dev
```

Starts the Vite dev server on port 5173.

### Terminal 4 -- ngrok (required for voice agent only)

```bash
ngrok http 8000
```

Copy the generated HTTPS URL into `BACKEND_PUBLIC_URL` in the `.env` file. This is required for Vapi tool calls to reach the local backend.

---

## Voice Agent Setup

These steps are required only once to configure the voice pipeline.

### 1. Create the Vapi assistant

```bash
cd Node_Backend
node scripts/createVapiAssistant.js
```

Creates the assistant on Vapi with the system prompt, GPT-4o model, Deepgram transcriber, and OpenAI TTS. Writes `VAPI_ASSISTANT_ID` to `.env`.

### 2. Link the Twilio phone number

```bash
node scripts/linkPhoneNumber.js
```

Registers the Twilio number with Vapi. Writes `VAPI_PHONE_NUMBER_ID` to `.env`.

### 3. Register tools

```bash
node scripts/registerVapiTools.js
```

Attaches all tool definitions to the assistant with URLs pointing to `BACKEND_PUBLIC_URL`.

### 4. Trigger a test call

```bash
node scripts/triggerCall.js
```

Initiates an outbound call to `MY_PHONE_NUMBER` via the configured assistant.

Note: If using a Twilio trial account, the destination phone number must be verified in the Twilio console, and international calling permissions (geo-permissions) must be enabled for the target country.

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require a valid JWT access token in the `accessToken` cookie.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/register` | Register a new restaurant admin |
| POST | `/api/admin/login` | Login, returns JWT cookies |
| POST | `/api/admin/logout` | Clears auth cookies |
| GET | `/api/admin/me` | Get current admin profile |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create a category |
| PUT | `/api/categories/:id` | Update a category |
| DELETE | `/api/categories/:id` | Delete a category |

### Food Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/food-items` | List all items |
| POST | `/api/food-items` | Create an item |
| PUT | `/api/food-items/:id` | Update an item |
| DELETE | `/api/food-items/:id` | Delete an item |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers |
| POST | `/api/customers` | Create a customer |
| PUT | `/api/customers/:id` | Update a customer |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List all orders with items |
| POST | `/api/orders` | Create an order |
| PATCH | `/api/orders/:id` | Update order status |

### Pricing (ML)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pricing/dynamic` | Engine 1: real-time price prediction |
| POST | `/api/pricing/optimize` | Engine 3: strategic price suggestion (single item) |
| GET | `/api/pricing/suggestions` | Engine 3: batch suggestions for all items |

### Upsell (ML)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upsell` | Engine 2: cart-based upsell recommendation |
| GET | `/api/upsell/top` | Top upsell pairs for dashboard |

### Recommendations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/recommendations` | Cart-based item recommendations |
| GET | `/api/recommendations` | Same, via query params |

### Voice (Internal -- called by Vapi)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/start-session` | Create voice session record |
| POST | `/api/voice/get-categories` | List available categories |
| POST | `/api/voice/get-menu` | Items in a category (max 5) |
| POST | `/api/voice/validate-items` | Fuzzy-match spoken item names |
| POST | `/api/voice/get-item-price` | Price lookup by name |
| POST | `/api/voice/get-upsell` | Intelligent upsell suggestion |
| POST | `/api/voice/push-order` | Place order (full transaction) |
| POST | `/api/voice/webhook` | Vapi event stream (live monitoring) |

---

## ML Engines

### Engine 1 -- Dynamic Pricing

- **Type:** XGBoost Regressor
- **Features:** 22 (including cyclical time encodings, margin ratios, competitor signals)
- **Output:** Optimal selling price, clamped to configured bounds
- **Endpoint:** `POST /engine1/predict` on ML Service

### Engine 2 -- Upsell Recommendation

- **Type:** XGBoost Classifier
- **Features:** 33 (synergy scores, price ratios, margin metrics, time context)
- **Output:** Best upsell candidate with acceptance probability and recommended discount
- **Endpoint:** `POST /engine2/predict` on ML Service

### Engine 3 -- Strategic Pricing

- **Type:** Two XGBoost Classifiers (Stage A: change?, Stage B: direction)
- **Features:** 35 (quadrant classification, margin headroom, popularity momentum)
- **Output:** Change decision, direction, magnitude, new price, BCG quadrant label
- **Endpoint:** `POST /engine3/predict` on ML Service

All models are pre-trained and stored as `.pkl` files in the `ML Models/` directory. They are loaded into memory once at ML Service startup.

---

## Database Schema

9 tables, all scoped by `admin_id` for multi-tenant isolation:

| Table | Purpose |
|-------|---------|
| `admin` | Restaurant operator accounts |
| `categories` | Menu categories |
| `food_items` | Menu items with pricing, stock, and ML fields |
| `customers` | Customer registry |
| `orders` | Order headers with status and totals |
| `order_items` | Line items with upsell tracking and price snapshots |
| `upsell_events` | Upsell offer log (accepted/rejected) for Engine 2 retraining |
| `voice_sessions` | Call audit log: transcript, intent, language, duration, conversion |
| `price_history` | Audit trail of all ML-driven price changes |

Refer to `DATABASE_SCHEMA.md` for full column definitions and constraints.


---
