# DM Hotel Booking and management system - Schema Design

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

## Schema Design
SCHEMADESIGN: D&M Travelers Inn Booking Management System

1. SYSTEM ARCHITECTURE OVERVIEW

The D&M Travelers Inn system employs a secure, decoupled architecture following a Frontend → RESTful API → Database pattern. This ensures strong separation of concerns, enhanced security, and independent scalability.

1.1. Architectural Layers
1.1.1. Presentation Layer (Frontend)
    Technology: React/Next.js, TypeScript, TailwindCSS, Framer Motion.
    Access: Interacts only with the Backend via secure RESTful API endpoints.
    Functionality: Public Website (Booking, Browsing) and Admin Management System (Operations).

1.1.2. Application Layer (Backend API)
    Technology: Node.js (Serverless Functions via Vercel).
    Role: Handles all business logic, security (Authentication, RBAC, Validation), and data persistence.
    Communication: Communicates with the Database via secure connections and handles external integrations (Stripe, PayPal, GCash, SMTP).

1.1.3. Data Layer (Database)
    Technology: Supabase PostgreSQL.
    Role: Persistent storage for all system data. Accessible only by the Backend API.

1.2. Data Flow for Public Booking
1. User interacts with the Frontend (Public Website).
2. Frontend submits reservation details via POST /api/bookings.
3. Backend validates input, checks real-time room availability against the Database.
4. Backend initiates 30% deposit payment via Stripe/PayPal/GCash.
5. Backend sends verification code via SMTP.
6. Upon code verification, the Database entry is created, and the booking status is set to 'Confirmed'.
7. Frontend receives confirmation and displays the Guest QR Code.

2. SECURITY ARCHITECTURE

Security is implemented through layered defense mechanisms integrated within the Backend API middleware.

2.1. Authentication and Authorization
2.1.1. Admin Users
    Mechanism: JWT (JSON Web Tokens).
    Process: Admin Login (POST /api/admin/login) issues a JWT. All subsequent Admin API calls require this token in the Authorization header.
    RBAC: The JWT payload includes the user's Role ID, which the authorization middleware uses to enforce permissions defined in the database (see Section 7).

2.1.2. Public Users (Guests)
    Mechanism: Email Verification Token.
    Process: Guests provide an email address; a one-time secure code is sent via SMTP. The booking process is finalized only after the guest submits this correct code, ensuring email validity without requiring permanent accounts.

2.2. API Security Measures
2.2.1. HTTPS Enforcement: All API communication must use TLS/SSL.
2.2.2. Input Validation and Sanitization: Strict validation (e.g., using Zod or Joi) on all incoming request bodies and parameters to prevent injection attacks (SQL, XSS).
2.2.3. SQL Injection Prevention: Utilizing parameterized queries (Supabase client features) to separate SQL commands from user-supplied data.
2.2.4. Rate Limiting: Implemented via middleware based on IP address (public endpoints) or User ID (authenticated endpoints) as detailed in the Rate Limiting Strategy documentation.
2.2.5. CSRF Protection: Essential for any state-changing POST/PUT/PATCH requests originating from the Admin interface (if using cookie-based sessions, otherwise managed via JWT validation headers).

3. FEATURE SPECIFICATIONS - DATABASE FOCUS

This section details critical data-dependent features and the corresponding logic implemented within the schema or application layer.

3.1. Real-Time Availability Checking
    Mechanism: The system checks the 'bookings' table for overlapping dates against any room whose status is NOT 'Cancelled' or 'No Show'. Transactions must be wrapped to prevent race conditions during simultaneous booking attempts (e.g., utilizing database advisory locks or `SELECT FOR UPDATE` if necessary, or relying on Supabase's built-in concurrency controls).

3.2. Automatic Room Allocation (Refer to room_allocation_logic)
    Logic prioritization: Room Type Match → Availability → Housekeeping Status (Clean & Ready) → Longest Vacancy Period.

3.3. Payment Deposit Strategy (Refer to payment_deposit_strategy)
    Database State Management: Bookings are held in 'Pending Payment' status for 15 minutes. If payment confirmation is not received, the associated room allocation is released, and the booking status reverts to 'Cancelled'.

3.4. Housekeeping Workflow (Refer to housekeeping_workflow_detail)
    State Transitions: Room status updates are logged in the 'rooms' table and tracked via the 'housekeeping_tasks' table to maintain an auditable history of room readiness.

4. DATABASE SCHEMA DESIGN (SUPABASE POSTGRESQL)

The schema is designed for data integrity, utilizing foreign keys, constraints, and appropriate indexing for performance.

4.1. Table Definitions and Relationships

4.1.1. admin_users
    Purpose: Stores credentials and metadata for administrative staff.
    Fields:
        id (uuid, pk)
        email (text, unique, not null)
        password_hash (text, not null)
        role_id (int, fk to roles.id, not null)
        is_active (boolean, default true)
        created_at (timestamp with time zone, default now())

4.1.2. roles
    Purpose: Defines administrative roles for RBAC.
    Fields:
        id (int, pk)
        name (text, unique, not null) -- e.g., 'Super Admin', 'Manager'
        description (text)

4.1.3. permissions
    Purpose: Defines granular permissions (e.g., 'bookings.create', 'rooms.delete').
    Fields:
        id (int, pk)
        name (text, unique, not null)

4.1.4. role_permissions (Junction Table)
    Purpose: Maps roles to specific permissions.
    Fields:
        role_id (int, fk to roles.id)
        permission_id (int, fk to permissions.id)
        PRIMARY KEY (role_id, permission_id)

4.1.5. rooms
    Purpose: Catalog of physical rooms in the hotel.
    Fields:
        id (uuid, pk)
        room_number (text, unique, not null) -- e.g., '201', '305'
        room_type (text, not null) -- Indexed for allocation logic
        floor (int)
        capacity (int, not null)
        base_price_per_night (numeric, not null)
        status (text, not null) -- 'Available', 'Occupied', 'Dirty', 'Maintenance'
        is_active (boolean, default true)
        maintenance_flag (boolean, default false) -- High-priority flag
        last_checkout_date (timestamp with time zone) -- For vacancy logic

4.1.6. bookings
    Purpose: Stores all reservation details.
    Fields:
        id (uuid, pk)
        reference_number (text, unique, not null) -- User-facing ID
        guest_id (uuid, fk to guests.id, nullable) -- Nullable for walk-in/no-account booking
        room_id (uuid, fk to rooms.id, nullable) -- Assigned physical room, nullable until check-in
        room_type_requested (text, not null)
        check_in_date (date, not null)
        check_out_date (date, not null)
        num_adults (int)
        num_children (int)
        total_amount (numeric, not null)
        deposit_paid (numeric, not null)
        balance_due (numeric, not null)
        status (text, not null) -- 'Pending Payment', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled'
        verification_code (text, unique, nullable) -- For email verification
        guest_qr_code (text, unique, nullable)
        special_requests (text)
        created_at (timestamp with time zone, default now())

4.1.7. guests
    Purpose: Stores contact information for non-account holders making bookings.
    Fields:
        id (uuid, pk)
        full_name (text, not null)
        email (text, not null)
        phone_number (text)
        PRIMARY KEY (id)

4.1.8. payments
    Purpose: Tracks all financial transactions related to bookings.
    Fields:
        id (uuid, pk)
        booking_id (uuid, fk to bookings.id, not null)
        transaction_id (text, unique, not null) -- Stripe/PayPal reference
        method (text, not null) -- 'Stripe', 'PayPal', 'GCash'
        amount (numeric, not null)
        type (text, not null) -- 'Deposit', 'Balance'
        status (text, not null) -- 'Success', 'Failed', 'Refunded'
        transaction_time (timestamp with time zone, default now())

4.1.9. reviews
    Purpose: Stores guest feedback.
    Fields:
        id (uuid, pk)
        booking_id (uuid, fk to bookings.id, unique)
        rating (int, not null, check (rating >= 1 AND rating <= 5))
        comment (text)
        is_approved (boolean, default false) -- Moderation required
        created_at (timestamp with time zone, default now())

4.1.10. restaurant_menu
    Purpose: Manages items available for dining services.
    Fields:
        id (uuid, pk)
        name (text, not null)
        description (text)
        price (numeric, not null)
        category (text) -- 'Breakfast', 'Lunch', 'Dinner', 'Drinks'
        is_available (boolean, default true)
        image_url (text)

4.1.11. housekeeping_tasks
    Purpose: Tracks cleaning assignments and status history for rooms.
    Fields:
        id (uuid, pk)
        room_id (uuid, fk to rooms.id, not null)
        assigned_to_admin_id (uuid, fk to admin_users.id, nullable)
        status (text, not null) -- 'Pending', 'In Cleaning', 'Clean', 'Maintenance'
        notes (text)
        completed_at (timestamp with time zone, nullable)

4.1.12. settings
    Purpose: Stores global hotel configuration.
    Fields:
        key (text, pk)
        value (text) -- Stored as JSON or string depending on the setting type.
        description (text)

5. REST API DOCUMENTATION (CORE ENDPOINTS)

All endpoints are secured via HTTPS and require appropriate authentication/validation middleware. Base URL: NEXT_PUBLIC_API_URL.

5.1. Authentication (Admin)
    POST /api/admin/login: Authenticate admin user. Returns JWT.

5.2. Rooms Management
    GET /api/rooms: Retrieve list of rooms (public view, public availability, admin detailed view). Supports query params for availability filtering (check_in, check_out).
    POST /api/rooms: Create new room (Admin only).
    PATCH /api/rooms/{id}: Update room details or status (Manager/Super Admin).

5.3. Bookings Management
    GET /api/bookings: Retrieve booking list (Admin view). Supports filtering by date, status, guest name.
    POST /api/bookings: Create a new reservation (Public facing - verification code required).
    PATCH /api/bookings/{id}: Update booking details (Admin/Manager). Includes check-in/check-out status changes.

5.4. Payments
    POST /api/bookings/payment: Initiate payment processing for deposit (called from public flow after verification).
    GET /api/bookings/{id}/payment_status: Check current payment status.

5.5. Housekeeping
    GET /api/housekeeping/rooms: Get rooms needing attention (Housekeeping/Manager).
    PATCH /api/housekeeping/room/{room_id}/status: Update room cleaning status.

6. BOOKING FLOW DIAGRAM (Simplified State Machine)

Start (Guest Selects Dates/Type)
|
V
Guest Input Details (Name, Email, Phone)
|
V
Email Verification Code Sent (SMTP)
|
V
Guest Enters Code
|
V
[IF Code Valid]
    --> Check Availability & Allocate Room (Automatic Logic)
    |
    V
    Payment Gateway Selection (Stripe/PayPal/GCash)
    |
    V
    30% Deposit Payment Processed
    |
    V
    [IF Payment Success]
        --> Booking Status: CONFIRMED
        --> Generate QR Code
        --> Email Confirmation Sent
        --> Room Status: OCCUPIED (for first night)
    |
    V
    [IF Payment Fails OR Timeout (15 min)]
        --> Booking Status: CANCELLED
        --> Room Status: AVAILABLE (Re-released)
End (Confirmation Screen)

Check-In Event (Upon Arrival)
|
V
Staff Scan QR Code / Enter Reference
|
V
Guest Pays Remaining 70% Balance
|
V
Booking Status: CHECKED-IN
Room Status: OCCUPIED
|
V
Check-Out Event (Upon Departure)
|
V
Booking Status: CHECKED-OUT
Room Status: DIRTY

7. ADMIN WORKFLOW DIAGRAMS - ROOM CHECK-IN/CHECK-OUT

7.1. Check-In Workflow (Staff/Manager)
Start (Front Desk)
|
V
Staff verifies Guest ID/QR Code
|
V
System retrieves Booking Record
|
V
[Check Balance Due]
    --> If Balance Due > 0: Prompt Guest for Remaining 70% Payment
    |
    V
    [If Payment Successful]
        --> Update Payment Log (Status: Fully Paid)
        --> Update Booking Status to CHECKED-IN
        --> Update Room Status to OCCUPIED
        --> System Logs Check-In Time
    |
    V
    [If Balance Due = 0 (Deposit Paid in Full)]
        --> Update Booking Status to CHECKED-IN
        --> Update Room Status to OCCUPIED
    |
    V
End (Guest Receives Keys)

7.2. Check-Out Workflow (Staff/Manager)
Start (Front Desk)
|
V
Staff finalizes incidental charges (if any)
|
V
Update Booking Status to CHECKED-OUT
|
V
Update Room Status to DIRTY
|
V
Log Last Checkout Date (for allocation logic)
|
V
Notify Housekeeping Queue
|
V
End (Room released for cleaning)

8. UI / UX GUIDELINES (Referenced from public_website_branding)

Design Style: Mobile-first, Card-based, Clean, Modern Hospitality aesthetic.
Color Scheme: Primary Blue (#07008A), Accent Yellow (#FED501), Base White (#FFFFFF).
Typography: Inter (Primary).
Interactions: Heavy use of Framer Motion for smooth scrolling, card reveals, and page transitions to meet performance and aesthetic targets.

9. SEO STRATEGY (Referenced from seo_specific_location)

9.1. Technical SEO
    Assets: Sitemap.xml, Robots.txt generation required.
    Optimization: Lazy Loading implemented for all media assets (images, galleries). Image optimization via Vercel/Next.js pipeline.

9.2. On-Page and Metadata
    Content Focus: Location keywords (Plaridel, Misamis Occidental, Baobawon Island).
    Metadata: Ensure all pages feature unique, descriptive Meta Titles, Meta Descriptions, Open Graph, and Twitter Card tags.

9.3. Structured Data
    Implementation: Hotel Schema Markup generated dynamically based on room types, amenities, and geo-location data to enhance SERP features.

10. DEPLOYMENT STRATEGY (Referenced from admin_deployment_preference)

10.1. Frontend (Public Site & Admin Interface)
    Platform: Vercel.
    Workflow: Git integration (GitHub). Automatic deployment upon merge to main/production branch.

10.2. Backend API
    Platform: Vercel Serverless Functions.
    Implementation: Node.js API routes deployed as serverless functions, scaling automatically based on request load.

10.3. Database & Secrets Management
    Database: Supabase (Managed PostgreSQL).
    Environment Variables: All secrets (DATABASE_URL, JWT_SECRET, Payment Keys) must be managed securely in Vercel Environment Variables (Development and Production scopes) and MUST NEVER be committed to source control.

11. DATA RETENTION POLICIES (Referenced from data_retention_policy)

11.1. Bookings: 5 years retention for completed bookings for auditing, then deletion/archival.
11.2. Payments: 7 years archival for financial compliance.
11.3. Reviews: Indefinite retention for public reviews.

12. KEY PERFORMANCE INDICATORS (KPIs) (Referenced from performance_metrics)

12.1. Public Website Performance: LCP target ≤ 2.5 seconds; CLS target ≤ 0.1.
12.2. API Performance: Booking confirmation latency target ≤ 1.5 seconds.
12.3. Reliability: System uptime target ≥ 99.9%.

13. AUTOMATIC ROOM ALLOCATION RULES (Referenced from room_allocation_logic)

13.1. Primary Priority: Clean & Ready status.
13.2. Secondary Priority: Room that has been vacant the longest to balance utilization.
13.3. Exclusion: Rooms marked 'Maintenance' or 'Dirty' are excluded from the assignment pool.

14. FORM FIELD REQUIREMENTS (Referenced from customization_of_forms)

14.1. Public Booking Form: Must collect Name, Email, Dates, Guests, Special Requests. Email verification is mandatory prior to confirmation.
14.2. Admin Forms: Must capture all necessary operational data (pricing, status flags, menu details, user roles) managed separately via the Admin Panel.

15. API RATE LIMITING (Referenced from rate_limiting_strategy)

15.1. Public Booking Endpoint (POST /api/bookings): Strict limit of 5 requests per IP per hour to prevent spam, supplemented by email verification.
15.2. Admin Endpoints: Higher thresholds applied per authenticated User ID, utilizing sliding window logic. Response code 429 with Retry-After header upon breach.
