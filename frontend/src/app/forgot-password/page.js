'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, KeyRound, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setEmail('');
      } else {
        setError(data.error || 'Failed to send reset instructions');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center mx-auto mb-1">
              <KeyRound className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl font-bold">Forgot Password?</CardTitle>
            <CardDescription className="text-xs">
              Enter your registered email address and we&apos;ll send you instructions to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-xs font-medium">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-ok/10 border border-ok/20 text-ok p-3.5 rounded-lg text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle className="h-4 w-4" /> Request Submitted
                </div>
                <p className="text-muted-foreground">{message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Account Email</label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="analyst@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg pl-9 pr-3.5 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Sending Instructions...
                  </>
                ) : (
                  'Send Password Reset Link'
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="border-t border-border pt-4 pb-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
