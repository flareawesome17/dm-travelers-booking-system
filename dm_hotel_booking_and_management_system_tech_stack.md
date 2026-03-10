# DM Hotel Booking and management system - Tech Stack

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

## Tech Stack
TECHNOLOGY STACK DOCUMENTATION: D&M Travelers Inn Booking Management System

VERSION: 1.0
DATE: 2024-05-20
AUTHOR: Senior Software Architect Team

1. INTRODUCTION

This document outlines the chosen technology stack for the D&M Travelers Inn Booking and Management System. The stack prioritizes security, scalability, performance, maintainability, and adherence to modern decoupled architectural patterns. The system is divided into two primary components: the Public Website (Customer Facing) and the Admin Management System.

2. ARCHITECTURAL OVERVIEW

The system employs a secure, decoupled, three-tier architecture:
Frontend (Client) $ightarrow$ RESTful API (Gateway/Backend) $ightarrow$ Database (Persistence Layer).

Frontend applications will communicate exclusively with the backend via secured RESTful APIs, ensuring sensitive data and business logic reside securely on the server side.

3. FRONTEND STACK (PUBLIC WEBSITE & ADMIN SYSTEM)

The frontend stack is designed for optimal performance, responsiveness, and a modern, engaging user experience, heavily leveraging visual appeal via Framer Motion.

| Component | Technology | Justification |
| :--- | :--- | :--- |
| Core Framework | Next.js (React) | Provides server-side rendering (SSR) and static site generation (SSG) capabilities essential for SEO optimization (Public Site) and fast initial load times. Offers excellent developer experience and routing. |
| Language | TypeScript | Enforces static typing across the codebase, significantly improving maintainability, reducing runtime errors, and facilitating large-scale development across the frontend team. |
| Styling | Tailwind CSS | Utility-first CSS framework enabling rapid, consistent UI development while keeping CSS bundles small. Supports a mobile-first design approach. |
| Animation | Framer Motion | Industry-leading library for complex, performant, and declarative React animations, crucial for achieving the desired smooth UX and visual appeal on the Public Website. |
| Animation Enhancement | GSAP / CSS Animations (Optional) | Used selectively for specific, high-impact micro-interactions where absolute control over timing and rendering is required, complementing Framer Motion where necessary. |

4. BACKEND STACK (RESTful API)

The backend is designed as a robust, secure, and scalable API layer using Node.js, optimized for handling concurrent booking requests and administrative tasks.

| Component | Technology | Justification |
| :--- | :--- | :--- |
| Core Server | Node.js (Express Framework) | Excellent for building fast, non-blocking I/O intensive APIs, ideal for handling numerous concurrent booking requests and integration with various external services (Stripe, Email). |
| API Architecture | RESTful API | Standardized, language-agnostic interface allowing for clean separation between frontend clients and backend services. All communication must use HTTPS. |
| Middleware | Custom Security Middleware | Essential for enforcing JWT validation, request sanitization, rate limiting, and Role-Based Access Control (RBAC) before requests hit the core business logic. |
| Deployment | Vercel Serverless Functions | Chosen for its unparalleled scalability, zero-maintenance operations, and seamless integration with the frontend deployment (refer to \\"Deployment Strategy\\" for details). |

5. DATA PERSISTENCE AND MANAGEMENT

| Component | Technology | Justification |
| :--- | :--- | :--- |
| Database | Supabase PostgreSQL | A highly reliable, open-source, scalable relational database. PostgreSQL provides transactional integrity critical for booking and payment processing, ensuring consistency during double-booking prevention. Supabase offers managed hosting and integrated features (Auth, Realtime). |
| ORM/Query Layer | Prisma (Recommended) | Modern ORM that works excellently with TypeScript and Node.js, providing type-safe database access and simplifying complex SQL queries, aiding in SQL injection prevention. |

6. SECURITY AND AUTHENTICATION

Security is paramount. The stack supports strict credential management and established authorization mechanisms.

| Component | Technology | Justification |
| :--- | :--- | :--- |
| Public User Auth | Email Verification Codes | Avoids guest credential storage. Uses SMTP tokens for ephemeral, one-time verification required for booking confirmation, aligning with the "No accounts required" mandate. |
| Admin User Auth | JSON Web Tokens (JWT) | Standardized, stateless authentication mechanism for securing API endpoints. JWTs will be short-lived, requiring refresh, and validated via secure middleware. |
| Access Control | Custom RBAC Implementation | Logic implemented in the backend middleware to map authenticated JWT claims against defined roles (Super Admin, Manager, Staff, Housekeeping) and associated permissions. |

7. EXTERNAL INTEGRATIONS

| Service | Technology | Purpose |
| :--- | :--- | :--- |
| Payments | Stripe, PayPal, GCash | Providing diverse and reliable online payment gateways for the required 30% deposit. |
| Email System | SMTP Service (e.g., SendGrid, AWS SES) | Essential for sending time-sensitive booking verification codes and final confirmations. Reliability and deliverability are key concerns. |

8. ENVIRONMENT VARIABLE MANAGEMENT

Sensitive credentials are *never* hardcoded. They must be managed via environment variables (.env files) during development and through secure Secret Managers in production environments (e.g., Vercel Secrets, AWS Secrets Manager).

Development .env Structure (for local development):
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

Production Environment Management:

For production deployment on Vercel, environment variables must be configured via the Vercel dashboard secrets management system. The \\"NEXT_PUBLIC_API_URL\\" variable must be exposed to the frontend build process, while database keys and payment secrets must be restricted to serverless functions only.

9. KEY ARCHITECTURAL CONSIDERATIONS

9.1. RESTful API Security Requirements

All endpoints (listed below) must enforce:
*   **HTTPS Only**: Mandatory encryption for all data transit.
*   **Input Validation**: Strict schema validation on all incoming JSON payloads to prevent injection attacks.
*   **Request Validation**: Utilize rate limiting thresholds as defined in the strategy documentation.
*   **Authentication**: JWT verification for all Admin endpoints.
*   **SQL Injection Prevention**: Use parameterized queries or a robust ORM/Query Builder (Prisma).
*   **XSS Protection**: Output encoding on all data rendered to the frontend.

9.2. Core RESTful API Endpoints Example Structure

| Module | HTTP Method | Endpoint Path | Description | Security Requirement |
| :--- | :--- | :--- | :--- | :--- |
| Auth | POST | /api/admin/login | Admin login | None (Public) |
| Auth | POST | /api/admin/logout | Admin logout | JWT Required |
| Bookings | POST | /api/bookings | Create new public booking (Deposit stage) | Rate Limit (Public) |
| Bookings | GET | /api/bookings/{id} | Retrieve booking details | JWT or Verification Code |
| Rooms | GET | /api/rooms | List all available rooms | None (Public) |
| Rooms | POST | /api/rooms | Add new room | RBAC (Manager/Super Admin) |
| Reports | GET | /api/reports | Generate aggregated analytics | RBAC (Manager/Super Admin) |

10. DEPLOYMENT STRATEGY SUMMARY

The system adopts a Serverless-First approach leveraging Vercel for maximum agility and scale.

| System Component | Primary Host | Deployment Method | CI/CD Trigger |
| :--- | :--- | :--- | :--- |
| Public Website (Next.js) | Vercel | Static Generation/SSR | Git Push (Main Branch) |
| Backend API (Node.js Functions) | Vercel | Serverless Functions | Git Push (API Branch) |
| Database (Supabase) | Supabase Managed Cloud | Managed Service | Manual / Infra-as-Code Updates |

The integration ensures atomic deployments for the frontend and backend, managed entirely through GitHub repositories via Vercel’s native pipeline.
