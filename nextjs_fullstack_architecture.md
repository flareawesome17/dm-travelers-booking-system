Senior-Level Next.js Fullstack Project Structure (Supabase)

Senior-Level Next.js Fullstack Architecture (Supabase)

project-root/
│
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── rooms/
│   │   ├── booking/
│   │   └── contact/
│   │
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── bookings/
│   │   ├── rooms/
│   │   ├── payments/
│   │   └── pos/
│   │
│   └── api/
│       ├── bookings/
│       │   └── route.ts
│       ├── rooms/
│       │   └── route.ts
│       ├── payments/
│       │   └── route.ts
│       └── auth/
│           └── route.ts
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── Table.tsx
│   │
│   ├── forms/
│   │   ├── BookingForm.tsx
│   │   └── PaymentForm.tsx
│   │
│   └── layout/
│       ├── AdminLayout.tsx
│       └── PublicLayout.tsx
│
├── modules/
│   ├── booking/
│   │   ├── booking.service.ts
│   │   ├── booking.repository.ts
│   │   ├── booking.types.ts
│   │   └── booking.validation.ts
│   │
│   ├── rooms/
│   │   ├── room.service.ts
│   │   ├── room.repository.ts
│   │   └── room.types.ts
│   │
│   └── payments/
│       ├── payment.service.ts
│       ├── payment.repository.ts
│       └── payment.types.ts
│
├── lib/
│   ├── supabaseClient.ts
│   ├── auth.ts
│   └── permissions.ts
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── types/
│   ├── booking.ts
│   ├── room.ts
│   └── user.ts
│
├── utils/
│   ├── currency.ts
│   ├── formatDate.ts
│   └── validators.ts
│
├── middleware.ts
├── .env
├── next.config.js
└── package.json

