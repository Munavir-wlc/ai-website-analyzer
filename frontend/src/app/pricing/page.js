'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { Check, Zap, Shield, Users, ArrowRight, Sparkles, CreditCard } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12 space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Commercial VAPT Pricing Plans
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Flexible Security Scanning Tiers
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Upgrade your security auditing depth. Choose the plan that fits your developer, consulting, or enterprise security needs.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                billingCycle === 'monthly' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                billingCycle === 'annual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Annual Billing <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold ml-1">(Save 20%)</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Free Tier */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col justify-between space-y-6 relative overflow-hidden shadow-xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Free Developer</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">For individual quick security health checks</p>
              </div>
              <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                $0 <span className="text-xs text-slate-500 font-normal">/ month</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pt-4 border-t border-slate-200 dark:border-slate-800">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> 3 Quick Passive Scans / mo</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> SSL Certificate Validation</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Security Headers Grading</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> DNS SPF & DMARC Audit</li>
                <li className="flex items-center gap-2 text-slate-400 dark:text-slate-500"><Check className="h-4 w-4 text-slate-300 dark:text-slate-700" /> OWASP ZAP Active Scanning</li>
                <li className="flex items-center gap-2 text-slate-400 dark:text-slate-500"><Check className="h-4 w-4 text-slate-300 dark:text-slate-700" /> Server PDF Report Downloads</li>
              </ul>
            </div>
            <button
              disabled
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 font-bold py-3 rounded-xl text-xs cursor-default"
            >
              Current Default Tier
            </button>
          </div>

          {/* Pro Tier */}
          <div className="bg-white dark:bg-gradient-to-b dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-8 flex flex-col justify-between space-y-6 relative overflow-hidden shadow-2xl shadow-indigo-500/10">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
              Most Popular
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Pro Engineer
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">For security consultants & active app owners</p>
              </div>
              <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                ${billingCycle === 'annual' ? '24' : '29'} <span className="text-xs text-slate-500 font-normal">/ month</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-800 dark:text-slate-200 pt-4 border-t border-slate-200 dark:border-slate-800">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> <strong>Unlimited</strong> Quick & Full Scans</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> 15-Port TCP Administrative Scanner</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> OWASP ZAP Active Probing</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Interactive AI Remediation Chat</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Unlimited Server PDF Downloads</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Priority Worker Scan Execution</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout('pro')}
              disabled={loadingPlan === 'pro'}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              {loadingPlan === 'pro' ? 'Processing...' : 'Upgrade to Pro Plan'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Team Tier */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col justify-between space-y-6 relative overflow-hidden shadow-xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" /> Team Enterprise
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs">For security teams & organizations</p>
              </div>
              <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
                ${billingCycle === 'annual' ? '79' : '99'} <span className="text-xs text-slate-500 font-normal">/ month</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pt-4 border-t border-slate-200 dark:border-slate-800">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Everything in Pro Plan</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> <strong>Multi-User Workspaces</strong> (Up to 10 Members)</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Shared Team Scan History</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Centralized Team Asset Inventory</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Role-Based Access (Owner, Admin, Member)</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Top Priority Enterprise Worker SLA</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout('team')}
              disabled={loadingPlan === 'team'}
              className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
            >
              {loadingPlan === 'team' ? 'Processing...' : 'Upgrade to Team Plan'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
