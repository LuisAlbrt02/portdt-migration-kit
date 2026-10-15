'use client';

import React, { ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import ProtectedRoute from './auth/ProtectedRoute';

interface DashboardLayoutProps {
  children: ReactNode;
  showHealthNotification?: boolean;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex h-screen w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <div className="fixed left-0 right-0 top-0 z-30 border-b border-gray-200 bg-gray-100/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90 md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-md p-2 hover:bg-gray-200 dark:hover:bg-gray-800"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <span className="text-sm">Port Digital Twin</span>
            <span className="w-8" />
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] bg-gray-800 shadow-xl">
              <Sidebar />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto pt-16 md:pt-0">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}