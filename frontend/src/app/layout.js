import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../lib/AuthContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'AI Website Analyzer | SEO & Security Audit Platform',
  description: 'Analyze SEO, performance, and security vulnerabilities in seconds.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans text-slate-900 bg-slate-50">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
