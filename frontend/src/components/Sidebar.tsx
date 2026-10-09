'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor,
  Database,
  Home,
  Languages,
  LogOut,
  Map,
  Moon,
  Sun,
} from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { translations } from '../translations/translations';

export default function Sidebar() {
  const pathname = usePathname();

  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const t = translations[language];

  const navItems = [
    {
      name: t.dashboard,
      href: '/',
      icon: Home,
    },
    {
      name: t.portMap,
      href: '/map',
      icon: Map,
    },
    {
      name: t.historicalPortData,
      href: '/real-time',
      icon: Database,
    },
  ];

  const identity = user
    ? String(
        user.name ??
        user.email ??
        user.username ??
        'Data Lake user'
      )
    : '';

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar-bg p-4 text-sidebar-text">
      <div className="mb-8 flex items-center gap-3">
        <Anchor className="h-8 w-8" />

        <h1 className="text-xl font-bold">
          Port Digital Twin
        </h1>
      </div>

      {user && (
        <div className="mb-6 rounded-lg border border-gray-600 bg-gray-700 p-4">
          <p className="truncate text-sm font-semibold">
            {identity}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Data Lake
          </p>
        </div>
      )}

      <nav className="flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-6 px-2">
        <Link href="/shift2dc">
          <div className="rounded-lg border border-gray-600 bg-gray-700 p-4">
            <Image
              src="/images/shift2dc_logo.png"
              alt="Shift2DC"
              width={160}
              height={45}
            />
          </div>
        </Link>
      </div>

      <div className="mt-auto border-t border-gray-700 pt-4">
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex-1 rounded-md p-2 hover:bg-gray-700"
          >
            <Languages className="mx-auto h-4 w-4" />
            {language === 'en' ? 'PT' : 'EN'}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex-1 rounded-md p-2 hover:bg-gray-700"
            aria-label={
              theme === 'light'
                ? t.switchToDark
                : t.switchToLight
            }
          >
            {theme === 'light' ? (
              <Moon className="mx-auto h-4 w-4" />
            ) : (
              <Sun className="mx-auto h-4 w-4" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-md p-2 text-gray-300 hover:bg-red-600 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span>{t.signOut}</span>
        </button>
      </div>
    </aside>
  );
}