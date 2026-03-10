# DM Hotel Booking and management system - User Flow

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

## User Flow
# USER FLOW DOCUMENTATION: D&M Travelers Inn Booking Management System

**Document Version:** 1.0
**Date:** October 26, 2023
**Author:** Senior Software Architect / UX Designer Team
**System:** D&M Travelers Inn Booking Management System (Public Website & Admin System)

---

## 1. Overview and Goal

This User Flow documentation details the critical user journeys for the D&M Travelers Inn Booking Management System, covering both the public customer-facing website and the internal Admin Management System. The primary goal is to ensure seamless, secure, and efficient interactions for guests making reservations and for hotel staff managing operations.

All flows prioritize the mandated security architecture (Frontend $ightarrow$ RESTful API $ightarrow$ Backend $ightarrow$ Database) and adhere to established UX/Branding guidelines.

---

## 2. Public Website User Flows (Customer Facing)

The public website is optimized for high conversion, mobile-first performance, and guest accountless booking via email verification.

### 2.1. User Flow 1: Browsing and Initial Availability Check (Unauthenticated Guest)

**Goal:** Discover the hotel, view rooms, and check date availability quickly.

| Step | User Action | System Interaction / Wireframe Description | UX/Security Notes |
| :--- | :--- | :--- | :--- |
| 1.0 | Access Homepage (SEO optimized landing page). | **Wireframe:** Hero Section (Animated Image, Tagline), Quick Booking Form overlay. Uses Hotel Schema Markup. | **Performance:** LCP targets met via optimized assets and Vercel CDN. Mobile-first rendering. |
| 1.1 | Enters desired Check-In/Check-Out dates and Number of Guests. Clicks "Check Availability". | **API Call:** (GET /api/rooms?check\_in={date}&check\_out={date}&guests={count}) | **Security:** Unauthenticated access. Request tracked for Rate Limiting (100 req/IP/hr). |
| 1.2 | Views Room Listing Page. | **Wireframe:** List of available Room Types, displaying price range, capacity, and key amenities. Rooms that are fully booked are omitted or greyed out. | **Branding:** Uses Primary Blue for CTAs and Golden Yellow for pricing highlights. Framer Motion scroll-reveals on room cards. |
| 1.3 | Clicks "View Details" on a specific Room Type. | **Wireframe:** Detailed Room View (Gallery, full amenity list, map integration highlighting Baobawon Island proximity). | Displays SEO-optimized local content contextually. |
| 1.4 | Clicks "Book Now" on the chosen room type. | Navigates to the Reservation Form (Step 2.1). | --- |

### 2.2. User Flow 2: Accountless Booking Confirmation (Reservation Reference Generation)

**Goal:** Secure a room by completing the booking form and email verification.

| Step | User Action | System Interaction / Wireframe Description | UX/Security Notes |
| :--- | :--- | :--- | :--- |
| 2.1 | Fills out the Public Booking Form. | **Fields:** Full Name, Email, Phone (Optional), Special Request. Selects Payment Option (Deposit Only: Stripe/PayPal/GCash). | **Data Collection:** Adheres to `customization_of_forms` requirements. Non-logged-in users. |
| 2.2 | Submits the form. | **API Call:** (POST /api/bookings) $ightarrow$ (Checks real-time availability again to prevent double booking). | **Rate Limit:** Heavy limiting applied to this endpoint (5 req/IP/hr). |
| 2.3 | System generates a verification code (SMTP) and holds the reservation temporarily. | **System Action:** Booking status set to PENDING\_EMAIL\_VERIFICATION. Code sent to guest email. | **Payment Strategy:** 30% deposit payment prompt is now displayed before verification if online payment is chosen. |
| 2.4 | Guest receives email and enters the 6-digit verification code on the verification screen. | **Wireframe:** Simple input field for the code. | **Email System:** Relies on SMTP service reliability. |
| 2.5 | System validates code and processes the required 30% deposit via the chosen gateway (Stripe/PayPal/GCash). | **API Call:** (POST /api/bookings/{id}/pay\_deposit) $ightarrow$ Payment Gateway integration. | **Payment Strategy:** If deposit fails within 15 minutes, the booking is auto-canceled. |
| 2.6 | Booking Confirmed. | **Wireframe:** Confirmation Screen displaying Reservation Reference Number. System generates the Guest QR Code. **Email:** Confirmation email sent, including QR code and payment breakdown (Deposit Paid / Balance Due at Check-in). | **Feature:** Automatic Room Allocation logic runs immediately upon successful payment/confirmation to assign a physical room. **Security:** QR code links to a non-guessable booking reference URL. |

### 2.3. User Flow 3: Guest Check-In Process (Using QR Code)

**Goal:** Facilitate fast check-in using the pre-generated QR code.

| Step | User Action | System Interaction / Wireframe Description | UX/Security Notes |
| :--- | :--- | :--- | :--- |
| 3.1 | Guest arrives at the reception desk with their booking confirmation (digital or print). | Guest presents QR code. | --- |
| 3.2 | Hotel Staff (Role: Staff) scans the QR code or enters the Reference Number. | **API Call:** (GET /api/bookings/{reference\_id}) - Staff authenticated access. | **RBAC:** Requires Staff role or higher. |
| 3.3 | Staff views the Booking Details screen. | **Wireframe:** Displays Guest Info, Dates, Assigned Room Number, Deposit Paid, **Balance Due (70%)**, Status: CONFIRMED. | **Room Allocation:** Shows the automatically assigned room number. |
| 3.4 | Guest pays the remaining 70% balance (Cash/Card/GCash). | Staff manually records payment completion in the system interface. | **Payment Strategy:** Staff marks payment as "Fully Paid" via the Update interface. |
| 3.5 | Staff updates the booking status. | **API Call:** (PATCH /api/bookings/{id}) $ightarrow$ Status set to CHECKED\_IN. | **Housekeeping Integration:** System automatically triggers the Room Status change from Available $ightarrow$ Occupied. |

---

## 3. Admin Management System User Flows

The Admin system is accessed via secure JWT authentication, utilizing RBAC to restrict features based on roles (Super Admin, Manager, Staff, Housekeeping).

### 3.1. User Flow 4: Secure Admin Login (All Roles)

**Goal:** Authenticate securely using JWT.

| Step | User Action | System Interaction / Wireframe Description | UX/Security Notes |
| :--- | :--- | :--- | :--- |
| 4.1 | Accesses Admin Portal URL. | **Wireframe:** Minimalist login screen (Deep Blue/White branding). Fields: Username, Password. | **Security:** Uses HTTPS. CSRF token protection implemented. |
| 4.2 | Enters credentials and clicks "Login". | **API Call:** (POST /api/admin/login) $ightarrow$ Backend validates credentials against `admin_users` table. | **Rate Limiting:** Brute-force protection (5 attempts/IP/10 min). |
| 4.3 | Successful Login. | Backend returns JWT. Frontend stores JWT securely (HttpOnly cookie recommended). User is redirected based on role. | **Security:** JWT required for all subsequent API calls via Authorization header. |
| 4.4 | Unauthorized Attempt. | **API Call:** (POST /api/admin/login) returns 401 Unauthorized. | --- |

### 3.2. User Flow 5: Room Management (Manager/Super Admin)

**Goal:** Add, update, or retire hotel rooms.

| Step | User Action | System Interaction / Wireframe Description | RBAC Permissions Required |
| :--- | :--- | :--- | :--- |
| 5.1 | Navigates to "Room Management" module. | **Wireframe:** Table view of all rooms with filters (Type, Status). "Add New Room" CTA. | Manager, Super Admin |
| 5.2 | Clicks "Add New Room". | **Wireframe:** Form matching `customization_of_forms` (Room Number, Type, Capacity, Price, Amenities Checkboxes, Floor). | Manager, Super Admin |
| 5.3 | Enters details and saves the room. | **API Call:** (POST /api/rooms). System runs validation. | Manager, Super Admin |
| 5.4 | Updates an existing room (e.g., changes nightly rate or status). | **API Call:** (PATCH /api/rooms/{id}). If status changes to Maintenance, triggers Housekeeping workflow exclusion. | Manager, Super Admin |
| 5.5 | Views the Availability Calendar. | **Wireframe:** Visual representation of rooms vs. dates (Color-coded statuses: Green=Available, Red=Booked, Yellow=Maintenance). Drag-and-drop enabled for manual assignments (Manager/Super Admin only). | Manager, Super Admin, Staff, Housekeeping (View Only) |

### 3.3. User Flow 6: Housekeeping Task Management (Housekeeping Role)

**Goal:** Update room cleanliness status efficiently.

| Step | User Action | System Interaction / Wireframe Description | RBAC Permissions Required |
| :--- | :--- | :--- | :--- |
| 6.1 | Housekeeping Staff logs in and views the Housekeeping Dashboard. | **Wireframe:** Priority list view: Rooms marked Dirty (from check-outs). Color-coded status list. | Housekeeping |
| 6.2 | Staff selects a 'Dirty' room and starts cleaning. | **API Call:** (PATCH /api/rooms/{id}/status). Status changes to IN\_CLEANING. | Housekeeping |
| 6.3 | Staff completes cleaning. | **API Call:** (PATCH /api/rooms/{id}/status). Status changes to CLEAN. Logs timestamp. | Housekeeping |
| 6.4 | Staff identifies a broken AC unit during cleaning. | **System Action:** Staff marks status as MAINTENANCE and adds notes. | Housekeeping |
| 6.5 | Manager reviews Maintenance Flag. | Manager views the Room Calendar, sees the flag, and assigns necessary personnel or overrides the room status if maintenance is minor/completed. | Manager, Super Admin |

### 3.4. User Flow 7: Review Moderation (Manager/Super Admin)

**Goal:** Approve or reject public reviews before publishing.

| Step | User Action | System Interaction / Wireframe Description | RBAC Permissions Required |
| :--- | :--- | :--- | :--- |
| 7.1 | Manager navigates to the Reviews module. | **Wireframe:** Pending Review Queue. Displays Name, Rating, Comment, and associated Booking ID (if available). | Manager, Super Admin |
| 7.2 | Manager reviews a submission. | System checks the review against posting guidelines (e.g., profanity filter if implemented). | Manager, Super Admin |
| 7.3 | Manager Approves the review. | **API Call:** (PATCH /api/reviews/{id}/publish). Public visibility is enabled. The review content is used for SEO Schema Markup. | Manager, Super Admin |
| 7.4 | Manager Deletes an inappropriate review. | **API Call:** (DELETE /api/reviews/{id}). | Manager, Super Admin |

---

## 4. Core Backend System Flows

These flows describe system-level processes managed entirely by the backend.

### 4.1. System Flow A: Automatic Room Allocation Logic Execution

**Goal:** Assign the best available physical room to a confirmed booking based on established priority.

| Stage | System Action / Logic Executed | Output / Result |
| :--- | :--- | :--- |
| **Trigger** | Booking status changes to CONFIRMED (after 30% deposit payment). | --- |
| **A1: Filtering** | Filter rooms by exact `Room_Type` requested by the guest. | Set R1 (Eligible Rooms). |
| **A2: Date Availability** | Filter R1: Exclude rooms with overlapping booking dates or rooms marked Maintenance. | Set R2 (Available Rooms). |
| **A3: Housekeeping Priority** | Filter R2: Prioritize rooms where `room_status` = 'Clean' (Ready for allocation). | Set R3 (Ready Rooms). |
| **A4: Usage Balancing** | Sort R3 based on `Last_Vacant_Date` (Longest vacant first). | Set R4 (Prioritized List). |
| **A5: Final Assignment** | Select the top room from R4. Update the `bookings` table with the assigned `room_id`. | Booking status updated. Room status updated to OCCUPIED (future date). |
| **A6: Failover** | If R4 is empty (no rooms available across all types), the booking status remains CONFIRMED but the `room_id` is NULL, triggering an alert for Manual Override (Manager/Super Admin). | Manager notified via Dashboard alert. |

### 4.2. System Flow B: Payment Deposit Handling and Timeline Enforcement

**Goal:** Enforce the 30% deposit requirement and manage time-bound reservation holds.

| Step | Status Transition | Time Constraint / Action | System Record Update |
| :--- | :--- | :--- | :--- |
| B1 | INITIAL $ightarrow$ PENDING\_VERIFICATION | Verification code sent via SMTP. | Booking record created with temporary reference. |
| B2 | PENDING\_VERIFICATION $ightarrow$ PENDING\_PAYMENT | Email code validated by guest. | --- |
| B3 | PENDING\_PAYMENT $ightarrow$ CONFIRMED | 30% deposit successfully processed via Stripe/PayPal/GCash. | Payment Logged (Deposit Paid). Booking Status: CONFIRMED. |
| B4 | PENDING\_PAYMENT $ightarrow$ CANCELED | Payment **not** received within 15 minutes of Step B2 completion. | Booking Status: CANCELED. Room returned to availability pool. |
| B5 | CONFIRMED $ightarrow$ CHECKED\_IN | Staff records final 70% payment upon guest arrival. | Payment Logged (Balance Paid). Booking Status: CHECKED\_IN. |
| B6 | CONFIRMED $ightarrow$ CANCELED (No Show) | Check-in date passed without check-in. | Deposit forfeited (Non-refundable flag set in payment log). |

---

## 5. Reporting and Analytics Flow (Manager/Super Admin)

**Goal:** Generate comprehensive operational and financial reports.

| Step | User Action | System Interaction / Wireframe Description | RBAC Required |
| :--- | :--- | :--- | :--- |
| 8.1 | Navigates to Reports Dashboard. | **Wireframe:** Overview KPIs (Occupancy Rate, Daily Revenue). | Manager, Super Admin |
| 8.2 | Selects Report Type (e.g., Monthly Revenue, Room Popularity, Occupancy Forecast). Sets Date Range. | **API Call:** (GET /api/reports?type={...}&start={date}&end={date}). Backend queries historical `bookings` and `payments` data, potentially running forecasting models. | Manager, Super Admin |
| 8.3 | Views the generated chart/table. | **Wireframe:** Interactive charts powered by frontend charting libraries (e.g., Recharts/Chart.js visualization of Framer Motion animations). | Manager, Super Admin |
| 8.4 | Clicks "Export". Selects format (CSV or PDF). | Backend generates the file based on the visualized data. File is downloaded to the client. | Manager, Super Admin |
