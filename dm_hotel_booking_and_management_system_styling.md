# DM Hotel Booking and management system - Styling Guidelines

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

## Styling Guidelines
D&M Travelers Inn Booking Management System
STYLING GUIDELINES DOCUMENT

Document Version: 1.0
Date: 2024-07-30
Author: [Your Role/Team Name]

1. INTRODUCTION

1.1 Purpose
This document defines the styling guidelines, design system components, color palette, and typography standards for the D&M Travelers Inn Booking Management System. These guidelines apply cohesively to both the Public Website (Customer Facing) and the Admin Management System to ensure a consistent, professional, and user-centric experience.

1.2 Core Design Philosophy
The styling is built around the principle of providing "Affordable Comfort" and "Reliable Hospitality." The visual style must be clean, modern, and trustworthy, leveraging TailwindCSS for utility-first efficiency and Framer Motion for smooth, performance-aware interactions.

1.3 Target Audience
Development Team (Frontend Engineers), UX/UI Designers, QA Testers.

2. DESIGN SYSTEM & VISUAL LANGUAGE

2.1 Brand Color Palette
The palette is derived directly from the D&M Travelers Inn branding to establish strong visual recognition.

| Color Name | Hex Code | Usage Context | Meaning |
|---|---|---|---|
| Primary Blue | #07008A | Navigation, Primary Buttons, Headings, Active States | Trust, Professionalism, Reliability |
| Accent Yellow | #FED501 | Hover States, Pricing Highlights, Important Badges, CTA Accents | Warmth, Hospitality, Energy |
| Neutral White | #FFFFFF | Backgrounds, Content Cards, Clean Spacing | Clarity, Modernity, Readability |
| Neutral Gray (Light) | #F7F7F7 | Secondary backgrounds, Card borders | Subtle separation |
| Neutral Gray (Dark) | #333333 | Body Text, Form Labels | Readability |

Color Ratio Guideline: 60% White, 30% Primary Blue, 10% Accent Yellow.

2.2 Typography
We utilize modern, highly readable sans-serif fonts suitable for digital interfaces across all devices (mobile-first).

| Element | Font Family | Weight | Size Guideline (Mobile First) | Usage |
|---|---|---|---|---|
| Primary Headings (H1, H2) | Inter | Bold (700) | Scaled (e.g., 2.5rem to 4rem) | Main page titles, Hero text |
| Subheadings (H3, H4) | Inter | Semi-Bold (600) | Scaled (e.g., 1.5rem to 2rem) | Section titles, Card titles |
| Body Text | Inter | Regular (400) | 16px (1rem) base | Paragraphs, Descriptions |
| UI Labels / Buttons | Inter | Medium (500) | Slightly smaller than body text | Navigation links, Form labels, CTAs |

Fallbacks: Poppins, Open Sans.

2.3 Iconography
Use a consistent, lightweight, and modern icon set (e.g., Lucide or Material Icons). Icons must align with the Primary Blue color scheme or use high-contrast black/white against backgrounds. Icons should be used judiciously to enhance comprehension, not replace text labels entirely.

2.4 Spacing and Layout
Layouts must strictly adhere to a responsive, mobile-first structure using a 12-column grid system inherent to TailwindCSS.

Spacing Scale: Use the standard Tailwind utility scale (e.g., p-4, my-8, gap-3).
Emphasis on Whitespace: Generous use of whitespace (Neutral White background) is critical to achieve a clean, premium, and uncluttered feel, especially on the public booking pages.

2.5 Component Styling Principles (TailwindCSS)
All components must leverage utility classes directly for rapid iteration and maintainability.

Buttons:
Default State: Background Primary Blue (#07008A), White text, rounded-lg, subtle shadow.
Hover State: Background slightly darker Blue or Accent Yellow overlay, smooth transition via Framer Motion.
Primary CTA: Utilize Accent Yellow (#FED501) for maximum conversion focus (e.g., "Book Now").

Cards (Rooms, Menu Items):
Soft shadows (shadow-lg), generous padding, slightly rounded corners (rounded-xl). Background is Neutral White or Neutral Light Gray.

Forms:
Clean, high-contrast inputs. Focus state must use the Primary Blue border color.

3. ANIMATION GUIDELINES (Framer Motion)

Animations must enhance the user experience without causing cognitive load or performance degradation (adhering to CLS KPI targets).

3.1 Public Website Animations
Focus on delight, responsiveness, and guiding user attention.

Page Transitions: Utilize smooth, non-disruptive fades or gentle slide transitions between pages (Next.js route changes).
Scroll Reveal: Sections (Amenities, Featured Rooms) should animate into view elegantly as the user scrolls down (e.g., subtle upward slide and fade-in).
Micro-Interactions: Hovering over room cards should trigger a slight scale-up effect or shadow change. Button clicks should have immediate, brief feedback (tap effect).

3.2 Admin System Animations
Animations should prioritize feedback and clarity over aesthetics.

Loading States: Use subtle skeleton loaders or pulsing effects during API calls to indicate processing.
Success/Error Feedback: Use Framer Motion to briefly display confirmation banners (e.g., green banner for successful save, red for error) that auto-dismiss.

4. UI/UX PRINCIPLES

4.1 Public Website (Customer Facing)
Goal: Conversion Optimization, Trust Building, Mobile Speed.

Mobile-First Imperative: Design decisions start with the smallest viewport. Touch targets must be large enough for comfortable interaction.
Clarity in Booking: The booking form must be simple, linear, and require minimal inputs (adhering to the required fields documentation). Email verification step must be clearly explained.
Visual Hierarchy: The Hero section must immediately convey the hotel's value proposition and provide the primary booking widget.
Image Quality: High-resolution, professional imagery of rooms and facilities is mandatory. Use native image optimization techniques compatible with Vercel deployment.

4.2 Admin Management System
Goal: Efficiency, Data Clarity, Role-Based Access Control.

Data Density: Admin dashboards can afford higher data density than the public site, but must remain clean. Use tabular data effectively.
Color Coding: Leverage color for status indicators (e.g., Room Status: Green=Available, Red=Maintenance, Yellow=Dirty).
Calendar View: The Room Availability Calendar must use clear visual cues (color blocks) to represent bookings, check-in/out dates, and maintenance blocks.
Consistency: All CRUD interfaces within the admin panel must follow identical modal/form layouts to minimize training overhead for staff.

5. SEO AND ACCESSIBILITY STYLING CONSIDERATIONS

5.1 Accessibility (A11Y)
Color Contrast: Ensure all text (especially Neutral Dark Gray on Neutral White) meets WCAG AA standards. Primary Blue and Accent Yellow combinations must be tested for sufficient contrast ratio.
Focus States: Ensure clear, visible focus rings (using Primary Blue) for all interactive elements accessible via keyboard navigation.
ARIA Attributes: Implement necessary ARIA roles and labels, particularly for dynamic Framer Motion elements and complex data tables in the Admin system.

5.2 SEO Aesthetics
Content Layout: On the public site, use clear H1/H2/H3 hierarchy based on content relevance. Structure information logically to support schema markup interpretation.
Image Handling: Alt text for all images (especially room photos and amenities) must be descriptive and contextually relevant to improve visual search and accessibility.

6. TECHNICAL IMPLEMENTATION NOTES

6.1 TailwindCSS Configuration
The `tailwind.config.js` file must centralize all colors, typography settings, and spacing definitions based on this document. Customization should be managed exclusively via this configuration file.

6.2 Component Library Strategy
Components should be built atomically (e.g., using styled components or functional components wrapping Tailwind classes) to enforce standardization. Reusable components (e.g., DmButton, DmCard) must encapsulate these style rules.

6.3 Theming
While a single theme is currently defined, the structure should allow for future expansion (e.g., light/dark mode toggles for the Admin System) by structuring styles within theme providers where appropriate. Dark mode should prioritize accessible contrast against Primary Blue and Accent Yellow elements.
