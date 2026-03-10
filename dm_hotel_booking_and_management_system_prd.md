# DM Hotel Booking and management system - Product Requirements Document

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

travelers inn plaridel

plaridel travelers inn booking

affordable hotel plaridel

plaridel accommodation

budget hotel plaridel

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

## Product Requirements Document
PRODUCT REQUIREMENTS DOCUMENT (PRD)
D&M Travelers Inn Booking Management System

Version: 1.0
Date: October 26, 2023
Author: Senior Software Architect Team
Status: Draft

1. Introduction

1.1. Purpose

This Product Requirements Document (PRD) details the functional and non-functional requirements for the D&M Travelers Inn Booking Management System. This platform will provide a modern, secure, and highly performant solution for both public guest bookings and internal hotel administration.

1.2. Project Goals

The primary goals of the D&M Travelers Inn system are to:

1. Provide a seamless, fast, and mobile-first online booking experience for public users.

2. Implement a robust, decoupled, and secure Admin Management System for hotel operations.

3. Ensure high security standards across all architectural layers (API, database, and deployment).

4. Achieve industry-leading performance metrics, especially concerning page load times and booking confirmation latency.

5. Simplify internal operations through modules for room management, housekeeping, and restaurant inventory.

1.3. Stakeholders


* D&M Travelers Inn Management (Business Owners)

* Hotel Operations Staff (Managers, Front Desk Staff)

* Housekeeping Personnel

* Software Development Team

* Security & Compliance Officers

1.4. Scope Inclusions


* Public Customer-Facing Website (Booking, Viewing Info, Reviews).

* Secure Admin Management System (Operations, Configuration).

* Multi-gateway Payment Integration (Stripe, PayPal, GCash).

* Role-Based Access Control (RBAC) for administration.

* Automated Room Allocation and Housekeeping Workflow.

1.5. Scope Exclusions


* Advanced CRM or integrated loyalty programs (Phase 2 consideration).

* On-site Point of Sale (POS) for the restaurant (limited to menu management for now).

* Financial accounting export formats beyond CSV/PDF reports.

2. System Architecture and Technology Stack

2.1. Core Architectural Principle: Decoupled Microservices Style

The system mandates a secure, decoupled architecture to maximize scalability, maintainability, and independent deployment cycles.

Architecture Flow: Frontend \\( \ightarrow \\) RESTful API \\( \ightarrow \\) Backend Logic \\( \ightarrow \\) Database.

The Frontend must NEVER directly access the database.

2.2. Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| Frontend (Web) | React / Next.js, TypeScript, TailwindCSS, Framer Motion | High performance, SEO optimized, animated user interface. |
| Backend (API) | Node.js, RESTful API Architecture | Secure server logic, request validation, authentication handling. |
| Database | Supabase PostgreSQL | Secure, managed relational database service. |
| Authentication | JWT (Admin), Email Verification Tokens (Public) | Secure session management and user identity verification. |
| Payments | Stripe, PayPal, GCash | Secure transaction processing. |
| Deployment | Vercel (Frontend & Serverless Backend Functions) | Automated CI/CD, global CDN, auto-scaling. |
| Email System | SMTP Service | Booking confirmations, verification codes. |

2.3. Security Mandates

Security must be enforced at every layer:

* **HTTPS:** All external and internal communications must be encrypted.

* **Input Sanitization:** Strict sanitization on all API inputs to prevent XSS and injection attacks.

* **Request Validation:** Schemas must be validated on the backend before processing.

* **Environment Variables:** All sensitive credentials must be managed exclusively via environment variables (see Section 5.4).

3. Public Website (Customer Facing) Requirements

3.1. Performance and UX (Referenced KPI Data)

The public website must adhere strictly to the defined performance metrics, targeting industry-leading speed, especially on mobile connections.


* **Mobile-First Design:** Primary layout must prioritize mobile responsiveness.

* **Animation:** Utilize Framer Motion for smooth, professional UI transitions and scroll reveals to enhance engagement without degrading performance.

* **Conversion Optimization:** The booking path must be frictionless.

3.2. SEO Optimization Requirements (Referenced SEO Data)

The platform must be optimized for local search visibility.


* **Technical SEO:** Generation of sitemap.xml, robots.txt. Image optimization and lazy loading implementation.

* **Metadata:** Dynamic meta titles, descriptions, Open Graph tags, and Twitter cards must be implemented for all key pages (Rooms, Home, Booking Confirmation).

* **Structured Data:** Implementation of `Hotel` schema markup and `Review` schema markup, integrating location data (Plaridel, Misamis Occidental, near Baobawon Island).

3.3. Booking Reservation System (Accountless Flow)

Guests shall not be required to create persistent accounts.


**Booking Flow:**

1. Selection: Guest selects Room Type and dates.

2. Data Entry: Guest provides Full Name, Email, Phone (recommended), Special Requests.

3. Verification: System sends a time-sensitive 4-6 digit verification code to the provided email via SMTP.

4. Confirmation: Guest enters the code. If correct, the system proceeds to payment/deposit.

5. Payment: Guest pays the mandatory 30% deposit online.

6. Finalization: Booking is confirmed, referenced, and email confirmation sent.

* **Availability:** Real-time checking against the Room Availability Calendar to prevent double booking.

3.4. Online Payment Integration (Referenced Deposit Strategy)


* **Mandatory Deposit:** 30% of the total booking amount must be collected online upon verification.

* **Payment Gateways:** Integration with Stripe, PayPal, and GCash APIs.

* **Payment Status Tracking:** System must log transaction status (Pending, Paid Deposit, Fully Paid, Failed).

* **Balance:** The remaining 70% is marked as due upon check-in (Paid at Hotel).

* **Failure Handling:** If the 30% deposit fails, the booking is held in \\"Pending\\" for 15 minutes before automatic cancellation.

3.5. Guest Features Post-Booking


* **Reservation Reference:** Unique, non-guessable reference number assigned upon deposit payment.

* **QR Code Generation:** Upon full deposit confirmation, a unique QR code is generated for each booking, used for fast check-in.

* **Email Confirmation:** Automated email containing booking summary, QR code, and remaining balance details.

3.6. Reviews System


* Guests (even accountless) can submit reviews post-stay.

* Fields: Name, Rating (1-5), Comment.

* **Moderation:** All submitted reviews must be marked as \\"Pending\\" in the Admin system and require Admin approval (Manager/Super Admin) before appearing on the public website.

4. Admin Management System Requirements

4.1. System Access and Security


* **Authentication:** Secure login utilizing JWT sessions for all administrative access.

* **RBAC:** Strict enforcement of Role-Based Access Control (see Section 5.5).

* **Admin API Secret:** A secret configured via environment variables must be used for authenticated API calls (beyond standard JWT).

4.2. Room Management Module

Admins must be able to fully manage room inventory.


* **CRUD Operations:** Add, Edit, Archive (Disable) Rooms.

* **Configuration Fields (Minimum):** Room Number/Name, Room Type, Max Capacity, Base Rate/Night, Amenities list, Floor Number.

* **Image Management:** Ability to upload and manage room gallery images via the API.

4.3. Booking Management Module


* **Viewing:** Comprehensive list and detail view of all bookings (Past, Present, Future).
\   * Must show associated guest details, payment status, and assigned room number.

* **Modification:** Ability to update guest details, change dates (if available), and manually change room status.

* **Check-In/Check-Out:** Staff (Front Desk) must be able to manually perform check-in/out actions, including scanning the guest QR code for instant record retrieval.

* **Override:** Managers/Super Admins can override automatic room assignments.

4.4. Housekeeping Management Module (Referenced Workflow)


* **Visual Dashboard:** Dedicated interface showing all rooms categorized by status (Dirty, In Cleaning, Maintenance, Clean).

* **Status Updates:** Housekeeping staff must be able to update room status in real-time via their access role.

* **Task Logging:** System must log timestamps for status changes (Vacated \\( \ightarrow \\) Dirty \\( \ightarrow \\) Clean).

4.5. Restaurant Management Module


* **Menu Management:** CRUD operations for all menu items.

* **Categorization:** Items must be assigned to predefined categories (Breakfast, Lunch, Dinner, Drinks).

* **Pricing & Status:** Set price and toggle item availability instantly.

4.6. Reports and Analytics Module

The system must generate actionable data reports.


* **Report Types:** Daily Bookings, Monthly Revenue (by payment gateway), Room Popularity, Occupancy Rate (daily/monthly), Payment Statistics.

* **Data Export:** All primary reports must support export in CSV and PDF formats.

* **Forecasting:** Occupancy Forecasting feature based on historical data to aid staffing and pricing decisions.

5. Non-Functional Requirements

5.1. Security Architecture (Core Priority)


* **API Protection:** Implement Rate Limiting on all public endpoints, stricter limits on authentication endpoints (see Section 5.3).

* **Authentication:** JWT tokens must have appropriate expiry times. Refresh tokens or secure session management must be used for Admin users.

* **Data Validation:** Comprehensive server-side validation (input sanitization, type checking, length checks) to prevent SQL Injection and XSS.

* **RBAC Implementation:** Permissions must be checked on every API route access via middleware.

5.2. Performance Metrics (Referenced KPI Data)


* **Website Targets:** LCP \\( \\le \\) 2.5s, TTI \\( \\le \\) 3s.

* **API Latency:** POST /api/bookings \\( \\le \\) 1.5s.

* **Reliability:** System Uptime \\( \\ge \\) 99.9% monthly.

5.3. API Rate Limiting Strategy (Referenced Details)


* Public endpoints (Booking Submission) must be heavily rate-limited per IP address (e.g., Max 5 requests/hour per IP).

* Admin login endpoints must implement brute-force protection (e.g., 5 attempts/10 min per IP).

* Sliding window counters preferred over hard resets. Return HTTP 429 with \\"Retry-After\\" header upon breach.

5.4. Environment Variables and Secrets Management (Referenced Details)

Sensitive configuration must be managed via environment variables (\\*.env\\) and should NEVER be committed to source control.

Example Critical Variables:

DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, ADMIN_API_SECRET, STRIPE_SECRET_KEY, SMTP_USER, etc.

5.5. Role-Based Access Control (RBAC) (Referenced Details)

The following roles must be supported with granular permissions: Super Admin, Manager, Staff, Housekeeping. Permissions must be customized per module (Bookings, Rooms, etc.).

5.6. Data Retention Policy (Referenced Details)

Financial records (Payments) must be retained for 7 years in cold/archival storage. Booking records retained for 5 years for audit purposes. Guest reviews that are public remain indefinitely.

6. Database Schema Design (Supabase PostgreSQL)

The database schema must be designed for normalization and relational integrity.

| Table Name | Key Fields | Relationships | Notes |
| :--- | :--- | :--- | :--- |
| \\`admin_users\\` | id, email, hashed_password, role_id, is_active | One-to-Many with \\`roles\\` | Stores admin credentials. |
| \\`roles\\` | id, name (e.g., Manager), configuration_json | One-to-Many with \\`admin_users\\` | Stores role definitions. |
| \\`permissions\\` | id, name (e.g., bookings.create) | Many-to-Many with \\`roles\\` | Fine-grained access control mapping. |
| \\`rooms\\` | id, room_number, room_type_id, floor, capacity, base_price, status (Available, Dirty, etc.) | One-to-Many with \\`room_types\\` | Physical room inventory. |
| \\`room_types\\` | id, name (Standard Double), description | One-to-Many with \\`rooms\\` | Defines room categories. |
| \\`bookings\\` | id, guest_id, room_id, check_in_date, check_out_date, status (Pending, Confirmed, Checked-In), verification_code, qr_code_hash, total_amount, deposit_paid | One-to-One with \\`guests\\`, One-to-One with \\`room_id\\` | Core reservation table. |
| \\`guests\\` | id, full_name, email, phone, special_requests | One-to-One with \\`bookings\\` | Temporary/public user contact info. |
| \\`payments\\` | id, booking_id, amount, method, status, transaction_id, is_deposit | One-to-Many with \\`bookings\\` | Payment logging. |
| \\`reviews\\` | id, guest_name, rating, comment, is_approved, booking_id | One-to-One with \\`bookings\\` | Guest feedback. |
| \\`restaurant_menu\\` | id, name, description, price, category, is_available, image_url | None | Menu items. |
| \\`housekeeping_tasks\\` | id, room_id, assigned_staff_id, start_time, end_time, task_type (Cleaning, Maintenance), notes | One-to-One with \\`rooms\\` | Tracks cleaning lifecycle. |
| \\`settings\\` | key, value | None | Global hotel configuration (e.g., cancellation policy text). |

7. RESTful API Documentation (Contract)

All endpoints must be secured via HTTPS and employ the necessary authentication middleware based on the required access level.

7.1. Authentication Endpoints (Admin Only)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| POST | /api/admin/login | Authenticate admin user, return JWT. | None |
| POST | /api/admin/logout | Invalidate session/token (optional: server-side blacklist). | JWT |

7.2. Booking Endpoints (Public & Admin)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | /api/rooms | List all room types and current availability status. | None |
| POST | /api/bookings | Create a new booking (after email verification/deposit). | None |
| GET | /api/bookings/{id} | Retrieve specific booking details (guest access or admin access). | JWT (Admin) or Token validation (Guest) |
| PATCH | /api/bookings/{id} | Update booking details (Admin only). | JWT |
| POST | /api/bookings/verify | Submit verification code to confirm email. | None |
| POST | /api/bookings/payment/deposit | Process 30% deposit payment via gateway provider. | None |

7.3. Room Endpoints (Admin Only)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | /api/rooms | List all rooms with detailed status. | JWT |
| POST | /api/rooms | Create a new room record. | JWT |
| PATCH | /api/rooms/{id} | Update room configuration or status. | JWT |
| GET | /api/room_types | List available room types. | JWT |

7.4. Housekeeping Endpoints (Housekeeping/Manager Roles)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | /api/housekeeping/rooms/dirty | List rooms pending cleaning. | JWT |
| PATCH | /api/housekeeping/room/{id}/status | Update room status (e.g., Dirty -> In Cleaning). | JWT |

7.5. Reviews Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | /api/reviews | List all *approved* public reviews. | None |
| POST | /api/reviews | Submit a new review. | None |
| PATCH | /api/reviews/{id}/approve | Approve a pending review (Admin only). | JWT |

7.6. Restaurant Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | /api/menu | Get the full current restaurant menu. | None |
| POST | /api/menu | Create new menu item. | JWT |
| PATCH | /api/menu/{id} | Update menu item details. | JWT |

7.7. Reports Endpoints (Manager/Super Admin Only)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| GET | /api/reports/occupancy | Get occupancy forecast and historical data. | JWT |
| GET | /api/reports/revenue | Get revenue breakdown, exportable to CSV/PDF. | JWT |

8. Workflow Diagrams (Conceptual Descriptions)

8.1. Booking Flow Diagram (Referenced Customization Details)

1. Guest selects dates \\( \ightarrow \\) 2. System checks real-time availability (Room Types) \\( \ightarrow \\) 3. Guest submits data (Name, Email, etc.) \\( \ightarrow \\) 4. System sends Email Verification Code (SMTP) \\( \ightarrow \\) 5. Guest inputs code \\( \ightarrow \\) 6. **IF SUCCESS:** Booking created as PENDING. System initiates payment sequence. \\( \ightarrow \\) 7. Guest completes 30% Deposit (Stripe/PayPal/GCash) \\( \ightarrow \\) 8. **IF PAYMENT SUCCESS:** Booking status \\( \ightarrow \\) CONFIRMED. Auto Room Allocation occurs. Confirmation Email/QR Code sent. \\( \ightarrow \\) 9. **IF PAYMENT FAIL:** Booking status \\( \ightarrow \\) PENDING_FAIL, expires after 15 minutes.

8.2. Admin Workflow: Room Cleaning (Referenced Housekeeping Details)

1. Guest Check-Out \\( \ightarrow \\) System sets Room Status: \\( \ightarrow \\) DIRTY (Not available for booking). \\( \ightarrow \\) 2. Housekeeping Staff receives task alert \\( \ightarrow \\) Staff updates status: \\( \ightarrow \\) IN CLEANING. \\( \ightarrow \\) 3. Staff finishes cleaning \\( \ightarrow \\) Staff updates status: \\( \ightarrow \\) CLEAN (Ready for Inspection/Allocation). \\( \ightarrow \\) 4. **Manager Review (Optional):** If approved, Status \\( \ightarrow \\) AVAILABLE. \\( \ightarrow \\) 5. System integrates room into Automatic Allocation Pool.

9. UI / UX Guidelines (Referenced Branding)

9.1. Branding and Aesthetics


* **Color Palette:** Primary Blue (\\#07008A), Accent Yellow (\\#FED501), Base White (\\#FFFFFF). Strict adherence to the 60/30/10 color ratio guideline.

* **Typography:** Inter or Poppins for a modern, clean look.

* **Style:** Card-based layouts, soft shadows, and rounded corners to convey hospitality and approachability.

9.2. Animation Usage


* **Framer Motion:** Must be used for all main page transitions (smooth, non-jarring).

* **Scroll Reveal:** Subtle reveal animations for sections (Amenities, Featured Rooms) to guide user focus.

* **Micro-interactions:** Hover effects on booking buttons and room cards to provide immediate feedback.

9.3. Conversion Focus

The public website path from Landing Page to Final Booking Confirmation must involve the minimum necessary steps, prioritizing speed and clarity over extensive content presentation during the conversion funnel.

10. Deployment Strategy (Referenced Admin Preference)

10.1. Frontend (Public Website & Admin Interface)


* **Platform:** Vercel.

* **Method:** Git-based CI/CD integration with GitHub. Automatic deployment on successful merge to main branch.

* **Caching:** Leverage Vercel's global CDN to cache static assets and pre-rendered Next.js pages to meet LCP requirements.

10.2. Backend (Node.js API)


* **Platform:** Vercel Serverless Functions (or equivalent serverless environment optimized for Node.js).

* **Decoupling:** The API server must be deployed independently of the frontend build, communicating only via defined REST endpoints.

* **Scalability:** Serverless scaling ensures the API handles peak booking loads without manual intervention.

10.3. Database Deployment


* **Supabase:** Managed service ensuring high availability. Database migrations must be scripted and version-controlled alongside application code changes.

11. Project Deliverables Summary


1. System Architecture Documentation (Completed via this PRD structure).

2. Security Architecture Design (Detailed threat modeling and mitigation).

3. Feature Specifications (Completed in Sections 3 & 4).

4. Database Schema Definition (Completed in Section 6).

5. REST API Documentation (Contract defined in Section 7).

6. Booking Flow Diagrams (Described in Section 8.1).

7. Admin Workflow Diagrams (Described in Section 8.2).

8. UI / UX Guidelines (Reference Section 9).

9. SEO Strategy Outline (Reference Section 3.2 and input data).

10. Deployment Strategy (Reference Section 10).
