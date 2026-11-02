import './globals.css';

import type { Metadata } from 'next';
import { Cabin } from 'next/font/google';

import DashboardLayout from '../components/DashboardLayout';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';

const cabin = Cabin({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const anchorSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#1f2937"/>
    <g fill="none" stroke="white" stroke-width="3.5"
       stroke-linecap="round" stroke-linejoin="round">
      <circle cx="32" cy="12" r="5"/>
      <path d="M32 17v34"/>
      <path d="M22 27h20"/>
      <path d="M13 40a19 19 0 0 0 38 0"/>
      <path d="m8 40 5-5 5 5"/>
      <path d="m46 40 5-5 5 5"/>
    </g>
  </svg>
`;

const favicon = `data:image/svg+xml,${encodeURIComponent(anchorSvg)}`;

export const metadata: Metadata = {
  title: 'Port Digital Twin',
  description: 'Port Digital Twin',
  icons: {
    icon: favicon,
    shortcut: favicon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cabin.className}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <DashboardLayout>
                {children}
              </DashboardLayout>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}