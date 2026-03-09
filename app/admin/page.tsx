'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
      <p className="text-[#333]">Redirecting...</p>
    </div>
  );
}
