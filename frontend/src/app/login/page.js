'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import { Shield, Mail, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function LoginPage() {
  const { login, loading, error: authError, setError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const scanId = urlParams ? urlParams.get('scanId') : null;
  const registerUrl = scanId ? `/register?scanId=${scanId}` : '/register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setError(null);

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    await login(email, password);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background text-foreground px-4 py-12 relative overflow-hidden transition-colors duration-300">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/3 dark:bg-indigo-500/5 blur-3xl -z-10 pointer-events-none" />
      
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Website Analyzer
            </span>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">Welcome Back</h2>
          <p className="mt-2 text-sm text-slate-650 dark:text-slate-400">
            Sign in to access your audit reports and history
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 border border-slate-205 dark:border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
          <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/20 to-purple-500/0 rounded-3xl -z-10" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {(formError || authError) && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{formError || authError}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-205 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-955/80 border border-slate-205 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm shadow-sm"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-300 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center border-t border-slate-200 dark:border-slate-800/80 pt-6 text-sm text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href={registerUrl} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-550 dark:hover:text-indigo-305 transition-colors">
              Sign up free
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm font-semibold text-slate-550 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
            ← Back to scanner dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
