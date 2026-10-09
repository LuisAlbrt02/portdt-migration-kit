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

export const metadata: Metadata = {
  title: 'Port Digital Twin',
  description: 'Port Digital Twin',
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