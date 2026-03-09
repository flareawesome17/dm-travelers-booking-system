# DM Hotel Booking and management system - Project Structure

## Project Description
Act as a Senior Software Architect, Security Engineer, UX Designer, and Technical Documentation Writer.

Your task is to generate complete professional system documentation for a modern hotel platform called:

D&M Travelers Inn Booking Management System

The documentation must be production-ready, structured, and written for a professional development team.

The platform must include two main systems:

Public Website (Customer Facing)

Admin Management System

Security, scalability, performance, and maintainability must be treated as core design priorities.

Core Architecture Requirement

The system must follow a secure decoupled architecture.

Frontend and backend must be fully separated.

Frontend will never directly access the database.

Architecture flow:

Frontend → RESTful API → Backend → Database

Benefits:

Strong security

Clean architecture

Better scalability

Independent deployments

Safe credential management

Technology Stack

Frontend

React / Next.js

TypeScript

TailwindCSS

Framer Motion for UI animations

Optional animation libraries (GSAP or CSS animations)

Backend

Node.js API server

RESTful API architecture

Secure middleware

Database

Supabase PostgreSQL

Authentication

Admin users:

Secure login authentication

JWT-based sessions

Public users:

No accounts required

Email verification booking system

Deployment

Frontend:

Vercel

Backend:

Server or serverless deployment

Email System

SMTP email service for booking verification codes and booking confirmations

Payment Integration

Stripe

PayPal

GCash

Security Requirements

Security must be a core system design principle.

RESTful API Architecture

Frontend communicates with backend using secure REST APIs.

Example endpoints:

Authentication

POST /api/admin/login

POST /api/admin/logout

Bookings

GET /api/bookings

POST /api/bookings

PATCH /api/bookings/{id}

Rooms

GET /api/rooms

POST /api/rooms

PATCH /api/rooms/{id}

Reviews

GET /api/reviews

POST /api/reviews

Restaurant

GET /api/menu

POST /api/menu

Analytics

GET /api/reports

All APIs must use:

HTTPS

Request validation

Secure authentication

Environment Variables (.env)

Sensitive credentials must never be hardcoded.

All secrets must be stored in environment variables.

Example .env configuration:

DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

STRIPE_SECRET_KEY=
PAYPAL_CLIENT_ID=
GCASH_API_KEY=

ADMIN_API_SECRET=
NEXT_PUBLIC_API_URL=

Include documentation for managing environment variables in development and production.

API Security

Implement security best practices:

JWT authentication

Role-based access control

Input sanitization

Rate limiting

CSRF protection

SQL injection prevention

XSS protection

Role-Based Access Control (RBAC)

Admin system must support roles.

Roles:

Super Admin

Manager

Staff

Housekeeping

Permissions include:

Manage bookings

Manage rooms

Manage restaurant

Manage housekeeping

Manage reviews

Manage users

Manage settings

View reports

Roles must support custom permission configuration.

Project Overview

The system must provide a complete hotel management platform for D&M Travelers Inn.

Guests can:

Browse rooms

Check availability

Make reservations

Pay online

Read reviews

Explore hotel amenities

View restaurant menu

Admins can manage:

Bookings

Rooms

Restaurant menu

Reviews

Payments

Admin users

Housekeeping tasks

Hotel settings

Reports and analytics

Public Website (Customer Side)

The public website must be:

Mobile-first

SEO optimized

High performance

Animation-enhanced

Conversion optimized

Animations must use Framer Motion.

SEO Optimized Landing Page

Landing page must include:

Hero Section

Animated hero image

Hotel tagline

Quick booking form

Check-in / Check-out selector

Guest selector

Sections:

Amenities

Featured rooms

Restaurant preview

Guest testimonials

Map location

Booking call-to-action

Animations:

Scroll animations

Micro interactions

Smooth page transitions

SEO Requirements

Include:

Technical SEO

Sitemap.xml

Robots.txt

Lazy loading

Image optimization

Mobile performance optimization

Metadata

Meta titles

Meta descriptions

Open Graph tags

Twitter cards

Structured Data

Hotel schema markup

Review schema

SEO keywords:

travelers inn davao

davao travelers inn booking

affordable hotel davao

davao accommodation

budget hotel davao city

Booking Reservation System

Guests can book rooms without creating accounts.

Booking Flow

1 Guest selects room and dates
2 Guest fills reservation form

Fields:

Full name

Email

Phone number

Special request

3 System sends verification code via SMTP email
4 Guest enters verification code
5 Booking confirmed

Features:

Reservation reference number

Email confirmation

Real-time availability checking

Prevent double booking

Room Availability Calendar

Admin must have a visual calendar interface showing:

Room bookings by date

Available rooms

Reserved rooms

Check-in and check-out schedules

Features:

Monthly calendar view

Drag and drop booking adjustments

Color-coded room statuses

Automatic Room Allocation

System must support automatic room assignment.

Logic:

When a guest books a room type:

1 System checks available rooms
2 Automatically assigns the best available room
3 Admin can override manually

Rules:

Avoid double booking

Optimize occupancy

Respect room capacity

Online Payment Integration

Support online payments using:

Stripe

PayPal

GCash

Payment options:

Pay full amount

Pay reservation deposit

Pay at hotel

Features:

Payment confirmation

Transaction logging

Payment status tracking

Guest QR Code Check-In

After booking confirmation:

System generates unique QR code for the guest.

Uses:

Fast hotel check-in

Guest verification

Check-in process:

1 Guest presents QR code at reception
2 Staff scans code
3 Booking record opens instantly

Benefits:

Faster check-in

Reduced manual entry

Housekeeping Management

Housekeeping module must include:

Room status tracking

Statuses:

Clean

Dirty

In Cleaning

Maintenance

Housekeeping tasks

Assign cleaning staff

Track cleaning progress

Mark room ready

Dashboard shows:

Rooms needing cleaning

Cleaning schedule

Hotel Occupancy Forecasting

Analytics system should include occupancy forecasting.

Features:

Historical booking analysis

Predict peak occupancy

Forecast busy periods

Helps hotel plan:

Staff schedules

Room pricing

Promotions

Room Management

Admin can:

Add rooms

Edit rooms

Upload images

Set price

Define capacity

Add amenities

Enable or disable rooms

Restaurant Management

Admin can manage restaurant menu.

Features:

Add menu items

Upload images

Set price

Categorize dishes

Categories:

Breakfast

Lunch

Dinner

Drinks

Reviews System

Guests can submit reviews.

Fields:

Name

Rating

Comment

Admin moderation required before publishing.

Reports and Analytics

Admin reports include:

Daily bookings

Monthly revenue

Room popularity

Occupancy rate

Payment statistics

Export formats:

CSV

PDF

Database Design (Supabase)

Define schema for tables:

rooms

bookings

guests

payments

reviews

restaurant_menu

admin_users

roles

permissions

housekeeping_tasks

settings

Include table relationships.

Deliverables
Generate documentation including:
1 System Architecture
2 Security Architecture
3 Feature Specifications
4 Database Schema
5 REST API Documentation
6 Booking Flow Diagrams
7 Admin Workflow Diagrams
8 UI / UX Guidelines
9 SEO Strategy
10 Deployment Strategy

## Project Structure
# PROJECT STRUCTURE DOCUMENTATION: D&M Travelers Inn Booking Management System

**Document Version:** 1.0
**Date:** October 26, 2023
**Author:** Senior Software Architect Team

## 1. Introduction

This document defines the physical file and directory structure for the D&M Travelers Inn Booking Management System. The structure is designed to enforce the decoupled architecture (Frontend/Backend separation), maximize maintainability, support independent deployments, and align with modern development practices using React/Next.js for the frontend and Node.js for the secure RESTful API backend.

## 2. High-Level Structure

The project repository will be structured into two primary, top-level directories to enforce strict decoupling:

```
/DandM_TravelersInn/
├── /frontend/
├── /backend/
├── .gitignore
├── README.md
└── package.json (For monorepo tooling, if applicable, otherwise root dependencies are minimal)
```

## 3. Frontend Structure (`/frontend/`)

The frontend application uses **Next.js** for SSR/SEO capabilities, React, TypeScript, and TailwindCSS. It serves both the Public Website and the Admin Management System interface.

```
/frontend/
├── .next/                  # Next.js build output (ignored)
├── node_modules/
├── public/                 # Static assets (robots.txt, sitemap.xml, logos)
│   ├── favicon.ico
│   ├── images/             # Optimized and served images
│   ├── manifest.json
│   └── assets/             # Fonts, icons
├── src/                    # Source code directory
│   ├── app/                # Next.js 13+ App Router structure
│   │   ├── (marketing)/    # Public Website (Customer Facing) Pages
│   │   │   ├── page.tsx    # SEO Optimized Landing Page
│   │   │   ├── rooms/      # /rooms
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Room Detail Page
│   │   │   └── layout.tsx
│   │   ├── (admin)/        # Admin Management System Pages
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx        # Main Analytics/Reports Dashboard
│   │   │   │   ├── bookings/       # /admin/bookings
│   │   │   │   ├── rooms/          # /admin/rooms
│   │   │   │   ├── housekeeping/   # /admin/housekeeping
│   │   │   │   ├── restaurant/     # /admin/restaurant
│   │   │   │   └── users/          # RBAC Management
│   │   │   └── layout.tsx          # Admin Layout (Protected Routes)
│   │   ├── api/            # Next.js API Routes (Optional: Used for proxying or edge functions)
│   │   │   └── ...
│   │   ├── global.css      # Tailwind CSS imports and base styles
│   │   └── layout.tsx      # Root Layout (Shared structure, SEO metadata injection)
│   ├── components/         # Reusable UI components (Framer Motion integrated)
│   │   ├── common/         # Low-level components (Buttons, Inputs, Modals)
│   │   ├── layout/         # Navbars, Footers, Admin Sidebar
│   │   ├── marketing/      # Public Site specific components (Hero, Testimonials)
│   │   └── admin/          # Admin specific components (Calendar View, Report Charts)
│   ├── hooks/              # Custom React Hooks
│   ├── lib/                # Utility functions, API clients (Axios/Fetch wrapper)
│   │   ├── api-client.ts   # Configured client for backend interaction
│   │   └── seo-helpers.ts
│   ├── types/              # TypeScript interfaces and types
│   └── styles/             # Global styles or theme configuration (If not using global.css directly)
├── next.config.js          # Next.js configuration
├── tsconfig.json
├── tailwind.config.js      # TailwindCSS configuration (Color palette defined here)
└── postcss.config.js
```

### Frontend Directory Explanations:

*   **`src/app/`**: Utilizes Next.js App Router structure.
    *   **`(marketing)`**: Contains all public-facing routes. Grouping helps isolate layout and metadata specific to the marketing site (e.g., Hotel Schema markup).
    *   **`(admin)`**: Contains all routes protected by JWT authentication and RBAC. The layout enforces the admin panel structure (sidebar, header).
*   **`src/components/`**: Strict separation between generic, marketing, and admin components to prevent accidental exposure or confusion.
*   **`src/lib/api-client.ts`**: Crucial for security. This module will handle adding the necessary `Authorization: Bearer <JWT>` headers and ensuring all requests are directed to the secure backend API URL (`NEXT_PUBLIC_API_URL`).

## 4. Backend Structure (`/backend/`)

The backend is a secure RESTful API built with Node.js. Given the decoupled requirement and environment (Vercel deployment), this structure is optimized for Serverless Functions, often utilizing a framework like Express or Hapi, or directly leveraging Vercel's serverless capabilities. We assume an Express-like structure for modularity.

```
/backend/
├── node_modules/
├── src/
│   ├── config/             # Configuration and environment loading
│   │   ├── index.ts
│   │   └── db.ts           # Supabase client initialization
│   ├── controllers/        # Request handlers (Input validation, calling services)
│   │   ├── authController.ts
│   │   ├── bookingController.ts
│   │   ├── roomController.ts
│   │   └── restaurantController.ts
│   ├── middleware/         # Security and utility middleware
│   │   ├── authMiddleware.ts   # JWT verification
│   │   ├── rateLimiter.ts      # Rate limiting implementation
│   │   ├── validationMiddleware.ts # Joi/Zod schema validation
│   │   └── cors.ts
│   ├── models/             # Data access layer (Interaction with Supabase/DB)
│   │   ├── bookingModel.ts
│   │   ├── roomModel.ts
│   │   └── userModel.ts
│   ├── routes/             # API endpoint definitions
│   │   ├── admin/
│   │   │   ├── authRoutes.ts
│   │   │   └── managementRoutes.ts # Rooms, Bookings, Reports
│   │   ├── public/
│   │   │   └── bookingRoutes.ts    # Public booking submission
│   │   └── index.ts        # Main router assembly
│   ├── services/           # Business logic, complex operations (e.g., Room Allocation Logic)
│   │   ├── allocationService.ts    # Implements room_allocation_logic
│   │   ├── paymentService.ts       # Stripe/PayPal/GCash integration wrappers
│   │   └── emailService.ts         # SMTP handling
│   ├── types/              # TypeScript definitions (matching frontend where necessary)
│   └── server.ts           # Entry point (if using a traditional server setup, otherwise entry is handled by Vercel function structure)
├── .env.example            # Template for environment variables
├── package.json
└── tsconfig.json
```

### Backend Directory Explanations:

*   **Separation of Concerns (Controller vs. Service)**: Controllers handle HTTP requests and responses, perform initial validation, and delegate complex logic to the `services` layer. The `services` layer handles the actual business logic (e.g., `allocationService.ts` handles the `room_allocation_logic`).
*   **`middleware/`**: Centralized location for security enforcement (JWT checks, input sanitization, rate limiting).
*   **`routes/`**: Endpoints are grouped logically (`admin/` vs. `public/`) to easily apply different sets of middleware (e.g., public routes don't need JWT middleware).
*   **`config/`**: Ensures consistent database connection management across all services, loading secrets from environment variables defined in `.env`.

## 5. Environment Variables Management

Sensitive credentials and configuration settings must be managed via environment variables.

### A. Root Level (`.env.example`)

A template file must exist at the root of the repository (or within the backend directory) detailing all required variables. **This file must NOT contain actual secrets.**

```env
# --- DATABASE (Supabase) ---
SUPABASE_URL=
SUPABASE_SERVICE_KEY=  # Server-side key, never exposed to frontend
DATABASE_URL=          # Connection string if using direct PostgreSQL connection (optional)

# --- AUTHENTICATION ---
JWT_SECRET=            # Used for signing/verifying admin JWTs
ADMIN_API_SECRET=      # Secret used to secure specific admin API calls if needed

# --- FRONTEND CONFIGURATION ---
NEXT_PUBLIC_API_URL=   # Base URL for the backend API (e.g., https://api.dandmtravelers.com)

# --- EMAIL SERVICE (SMTP) ---
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# --- PAYMENT GATEWAYS ---
STRIPE_SECRET_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
GCASH_API_KEY=

# --- SECURITY/CACHING ---
# Redis URL, etc. (If caching layers are introduced)
```

### B. Frontend Exposure

Only variables prefixed with `NEXT_PUBLIC_` will be bundled into the frontend application build (e.g., `NEXT_PUBLIC_API_URL`). Secrets like `JWT_SECRET` or full payment gateway keys must *never* be prefixed with `NEXT_PUBLIC_`.

### C. Deployment Environment Variables

1.  **Development (Local):** Environment variables must be loaded from a local `.env` file in the respective project root (`/frontend/.env` and `/backend/.env`).
2.  **Production (Vercel/Serverless):** Environment variables must be configured directly within the Vercel deployment settings (or equivalent cloud provider dashboard) for both the frontend and backend serverless functions. This keeps secrets out of version control entirely.

## 6. Security Implications in Structure

1.  **Decoupling Enforcement:** The strict separation between `/frontend` and `/backend` ensures that client-side code cannot house sensitive server logic or database credentials.
2.  **API Gateway:** All communication must pass through the backend endpoints defined in `/backend/src/routes/`.
3.  **Frontend Proxies:** If the frontend needs to communicate with an external service (e.g., Stripe Checkout URL), it must be proxied through the secure backend to hide keys, or handled entirely client-side using only public keys where appropriate.
4.  **Public vs. Admin Routes:** Clear separation in `/backend/src/routes/` ensures that rate limiting and authentication middleware are applied correctly based on user context.
