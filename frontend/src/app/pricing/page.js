'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/lib/AuthContext';
import { Check, Zap, Shield, Users, ArrowRight, Sparkles, CreditCard, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function PricingPage() {
  const { token: authContextToken } = useAuth();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [subscription, setSubscription] = useState(null);

  const getAuthHeader = () => {
    const token = authContextToken || (typeof window !== 'undefined' ? localStorage.getItem('vapt_auth_token') : null);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/payment/subscription`, {
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
    }
  };

  const handleCheckout = async (plan) => {
    try {
      setLoadingPlan(plan);
      const res = await fetch(`${API_BASE}/api/payment/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({ plan })
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.message) {
        alert(data.message);
        fetchSubscriptionStatus();
      }
    } catch (err) {
      alert('Failed to initiate checkout session');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppShell activePath="/pricing">
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-3">
          <PageHeader
            title="Flexible Security Scanning Tiers"
            description="Upgrade your security auditing depth. Choose the plan that fits your developer, consulting, or enterprise security needs."
            className="border-b-0 pb-0 text-center items-center justify-center"
            breadcrumbs={[
              { label: 'Console', href: '/dashboard' },
              { label: 'Pricing Plans' }
            ]}
          />

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center bg-muted border border-border p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                billingCycle === 'monthly' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                billingCycle === 'annual' ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual Billing <span className="text-[10px] text-ok font-bold ml-1">(Save 20%)</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Free Tier */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="space-y-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold">Free Developer</CardTitle>
                <CardDescription className="text-xs">For individual quick security health checks</CardDescription>
              </div>
              <div className="text-3xl font-bold font-mono text-foreground pt-2">
                $0 <span className="text-xs text-muted-foreground font-normal">/ month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-xs text-muted-foreground border-t border-border pt-4">
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-ok shrink-0" /> 3 Quick Passive Scans / mo</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-ok shrink-0" /> SSL Certificate Validation</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-ok shrink-0" /> Security Headers Grading</li>
                <li className="flex items-center gap-2 text-foreground"><Check className="h-4 w-4 text-ok shrink-0" /> DNS SPF & DMARC Audit</li>
                <li className="flex items-center gap-2 opacity-40"><Check className="h-4 w-4 text-muted-foreground shrink-0" /> OWASP ZAP Active Scanning</li>
                <li className="flex items-center gap-2 opacity-40"><Check className="h-4 w-4 text-muted-foreground shrink-0" /> Server PDF Report Downloads</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                disabled
                className="w-full text-xs"
              >
                Current Default Tier
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Tier */}
          <Card className="flex flex-col justify-between border-primary ring-1 ring-primary shadow-sm relative">
            <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Recommended
            </div>
            <CardHeader className="space-y-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Pro Engineer
                </CardTitle>
                <CardDescription className="text-xs">For security consultants & active app owners</CardDescription>
              </div>
              <div className="text-3xl font-bold font-mono text-foreground pt-2">
                ${billingCycle === 'annual' ? '24' : '29'} <span className="text-xs text-muted-foreground font-normal">/ month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-xs text-foreground border-t border-border pt-4">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> <strong>Unlimited</strong> Quick & Full Scans</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> 15-Port TCP Administrative Scanner</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> OWASP ZAP Active Probing</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Interactive AI Remediation Chat</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Unlimited Server PDF Downloads</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Priority Worker Scan Execution</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => handleCheckout('pro')}
                disabled={loadingPlan === 'pro'}
                className="w-full gap-2 text-xs"
              >
                {loadingPlan === 'pro' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    Upgrade to Pro <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Team Tier */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="space-y-2">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Team Enterprise
                </CardTitle>
                <CardDescription className="text-xs">For security teams & organizations</CardDescription>
              </div>
              <div className="text-3xl font-bold font-mono text-foreground pt-2">
                ${billingCycle === 'annual' ? '79' : '99'} <span className="text-xs text-muted-foreground font-normal">/ month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-xs text-foreground border-t border-border pt-4">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Everything in Pro Plan</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> <strong>Multi-User Workspaces</strong> (Up to 10)</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Shared Team Scan History</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Centralized Team Asset Inventory</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Role-Based Access Controls</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-ok shrink-0" /> Top Priority Enterprise Worker SLA</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={() => handleCheckout('team')}
                disabled={loadingPlan === 'team'}
                className="w-full gap-2 text-xs"
              >
                {loadingPlan === 'team' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    Upgrade to Team <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
