# Lovable Build Guide - ManyHats Pro Smart Pricing Engine

This guide explains how to integrate the Lovable web app with the ManyHats Pro backend, including Supabase authentication, database queries, and Smart Pricing Engine integration.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Supabase Auth Integration](#supabase-auth-integration)
4. [Connecting to Supabase Backend](#connecting-to-supabase-backend)
5. [Core Data Models](#core-data-models)
6. [API Integration Examples](#api-integration-examples)
7. [Smart Pricing Engine Integration](#smart-pricing-engine-integration)
8. [Best Practices](#best-practices)

---

## Prerequisites

Before building with Lovable, ensure you have:

- ✅ Access to the Supabase project (URL and API keys)
- ✅ Supabase CLI installed locally (optional, for edge functions)
- ✅ Node.js 18+ and npm/yarn
- ✅ Familiarity with TypeScript and React
- ✅ Environment variables configured

### Required Dependencies

```json
{
  "@supabase/supabase-js": "^2.38.0",
  "@supabase/auth-helpers-react": "^0.4.0",
  "react": "^18.0.0",
  "typescript": "^5.0.0"
}
```

---

## Environment Setup

### 1. Create `.env.local` in your Lovable project

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# API Configuration
VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1

# Feature Flags
VITE_ENABLE_SMART_PRICING=true
VITE_ENABLE_AI_SUGGESTIONS=true
```

### 2. Initialize Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Supabase Auth Integration

### 1. Authentication Flow Setup

Create `src/hooks/useAuth.ts`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  return { user, session, loading };
};
```

### 2. Sign Up / Login Components

Create `src/components/Auth/SignUp.tsx`:

```typescript
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) throw signUpError;

      alert('Check your email for the confirmation link!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="w-full max-w-md">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
};
```

Create `src/components/Auth/Login.tsx`:

```typescript
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;
      // Redirect happens automatically via auth state change
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="w-full max-w-md">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Log In'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
};
```

---

## Connecting to Supabase Backend

### 1. Fetching Company Profiles

Create `src/hooks/useCompanyProfile.ts`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string;
  industry: string;
  email: string;
  phone: string;
  location: string;
  service_areas: string[];
  created_at: string;
  updated_at: string;
}

export const useCompanyProfile = (userId: string | undefined) => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (fetchError) throw fetchError;
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const updateProfile = async (updates: Partial<CompanyProfile>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('company_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) throw updateError;
      setProfile(data);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Update failed');
    }
  };

  return { profile, loading, error, updateProfile };
};
```

### 2. Fetching Estimates

Create `src/hooks/useEstimates.ts`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Estimate {
  id: string;
  company_id: string;
  customer_id: string;
  service_type: string;
  description: string;
  base_price: number;
  markup_percentage: number;
  final_price: number;
  confidence_score: number;
  ai_generated: boolean;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export const useEstimates = (companyId: string | undefined) => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchEstimates = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('estimates')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setEstimates(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch estimates');
      } finally {
        setLoading(false);
      }
    };

    fetchEstimates();
  }, [companyId]);

  const createEstimate = async (estimateData: Omit<Estimate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error: createError } = await supabase
        .from('estimates')
        .insert([estimateData])
        .select()
        .single();

      if (createError) throw createError;
      setEstimates([data, ...estimates]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Create failed');
    }
  };

  return { estimates, loading, error, createEstimate };
};
```

### 3. Fetching Proposals

Create `src/hooks/useProposals.ts`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Proposal {
  id: string;
  company_id: string;
  customer_id: string;
  estimate_id: string;
  title: string;
  description: string;
  total_amount: number;
  payment_terms: string;
  validity_days: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  updated_at: string;
}

export const useProposals = (companyId: string | undefined) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchProposals = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('proposals')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setProposals(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, [companyId]);

  const createProposal = async (proposalData: Omit<Proposal, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error: createError } = await supabase
        .from('proposals')
        .insert([proposalData])
        .select()
        .single();

      if (createError) throw createError;
      setProposals([data, ...proposals]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Create failed');
    }
  };

  return { proposals, loading, error, createProposal };
};
```

---

## Core Data Models

### Company Profiles Table

```sql
-- company_profiles
id: UUID (primary key)
user_id: UUID (foreign key to auth.users)
company_name: TEXT
industry: TEXT (e.g., 'septic', 'plumbing', 'electrical')
email: TEXT
phone: TEXT
location: TEXT (city, state)
service_areas: TEXT[] (array of service regions)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

### Estimates Table

```sql
-- estimates
id: UUID (primary key)
company_id: UUID (foreign key to company_profiles)
customer_id: UUID (foreign key to customers)
service_type: TEXT
description: TEXT
base_price: NUMERIC
markup_percentage: NUMERIC (0-100)
final_price: NUMERIC (calculated)
confidence_score: NUMERIC (0-100, from AI)
ai_generated: BOOLEAN
status: TEXT ('draft', 'sent', 'accepted', 'rejected')
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

### Proposals Table

```sql
-- proposals
id: UUID (primary key)
company_id: UUID (foreign key to company_profiles)
customer_id: UUID (foreign key to customers)
estimate_id: UUID (foreign key to estimates)
title: TEXT
description: TEXT
total_amount: NUMERIC
payment_terms: TEXT
validity_days: INTEGER
status: TEXT ('draft', 'sent', 'accepted', 'rejected', 'expired')
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

---

## API Integration Examples

### 1. Real-time Subscription Example

Create `src/hooks/useRealtimeEstimates.ts`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Estimate } from './useEstimates';

export const useRealtimeEstimates = (companyId: string | undefined) => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    // Initial fetch
    const fetchEstimates = async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('company_id', companyId);

      if (!error && data) {
        setEstimates(data);
        setLoading(false);
      }
    };

    fetchEstimates();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`estimates:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimates',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEstimates([payload.new as Estimate, ...estimates]);
          } else if (payload.eventType === 'UPDATE') {
            setEstimates(
              estimates.map((est) =>
                est.id === payload.new.id ? (payload.new as Estimate) : est
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setEstimates(estimates.filter((est) => est.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [companyId]);

  return { estimates, loading };
};
```

### 2. Batch Operations

Create `src/hooks/useBatchOperations.ts`:

```typescript
import { supabase } from '../lib/supabase';

export const useBatchOperations = () => {
  const updateMultipleEstimates = async (
    estimateIds: string[],
    updates: { status: string }
  ) => {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .update(updates)
        .in('id', estimateIds)
        .select();

      if (error) throw error;
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Batch update failed');
    }
  };

  const deleteMultipleEstimates = async (estimateIds: string[]) => {
    try {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .in('id', estimateIds);

      if (error) throw error;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Batch delete failed');
    }
  };

  return { updateMultipleEstimates, deleteMultipleEstimates };
};
```

---

## Smart Pricing Engine Integration

### 1. Calling the AI Pricing Edge Function

Create `src/services/smartPricingService.ts`:

```typescript
import { supabase } from '../lib/supabase';

export interface PricingRequest {
  service_type: string;
  location: string;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  labor_hours?: number;
  materials_cost?: number;
}

export interface PricingResponse {
  base_price: number;
  confidence_score: number;
  market_rate: number;
  supplier_quotes: Array<{
    supplier: string;
    price: number;
    availability: string;
  }>;
  ai_recommendations: string;
  price_range: {
    min: number;
    max: number;
  };
}

export const smartPricingService = {
  async generatePricing(
    request: PricingRequest
  ): Promise<PricingResponse> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'calculate-smart-pricing',
        {
          body: request,
        }
      );

      if (error) throw error;
      return data as PricingResponse;
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('Failed to generate pricing');
    }
  },

  async getMarketBenchmarks(
    serviceType: string,
    location: string
  ): Promise<{
    average_price: number;
    market_range: { min: number; max: number };
    trending: 'up' | 'down' | 'stable';
  }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'get-market-benchmarks',
        {
          body: { service_type: serviceType, location },
        }
      );

      if (error) throw error;
      return data;
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('Failed to fetch benchmarks');
    }
  },

  async getSupplierQuotes(
    materials: string[],
    location: string
  ): Promise<Array<{ supplier: string; price: number; availability: string }>> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'get-supplier-quotes',
        {
          body: { materials, location },
        }
      );

      if (error) throw error;
      return data;
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error('Failed to fetch supplier quotes');
    }
  },
};
```

### 2. React Hook for Smart Pricing

Create `src/hooks/useSmartPricing.ts`:

```typescript
import { useState } from 'react';
import {
  smartPricingService,
  type PricingRequest,
  type PricingResponse,
} from '../services/smartPricingService';

export const useSmartPricing = () => {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePricing = async (request: PricingRequest) => {
    setLoading(true);
    setError(null);

    try {
      const result = await smartPricingService.generatePricing(request);
      setPricing(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Pricing failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getMarketBenchmarks = async (
    serviceType: string,
    location: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      return await smartPricingService.getMarketBenchmarks(
        serviceType,
        location
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSupplierQuotes = async (
    materials: string[],
    location: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      return await smartPricingService.getSupplierQuotes(materials, location);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    pricing,
    loading,
    error,
    generatePricing,
    getMarketBenchmarks,
    getSupplierQuotes,
  };
};
```

### 3. Smart Pricing Component

Create `src/components/SmartPricing/PricingForm.tsx`:

```typescript
import { useState } from 'react';
import { useSmartPricing } from '../../hooks/useSmartPricing';
import type { PricingRequest } from '../../services/smartPricingService';

export const PricingForm = ({ onPricingGenerated }: { onPricingGenerated: (pricing: any) => void }) => {
  const [formData, setFormData] = useState<PricingRequest>({
    service_type: '',
    location: '',
    description: '',
    complexity: 'medium',
  });

  const { pricing, loading, error, generatePricing } = useSmartPricing();

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await generatePricing(formData);
      onPricingGenerated(result);
    } catch (err) {
      console.error('Pricing generation failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div>
        <label>Service Type</label>
        <input
          type="text"
          name="service_type"
          value={formData.service_type}
          onChange={handleChange}
          placeholder="e.g., Septic Tank Replacement"
          required
        />
      </div>

      <div>
        <label>Location</label>
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="e.g., Denver, CO"
          required
        />
      </div>

      <div>
        <label>Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Detailed description of the work..."
          required
        />
      </div>

      <div>
        <label>Complexity</label>
        <select
          name="complexity"
          value={formData.complexity}
          onChange={handleChange}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Generating Pricing...' : 'Generate Smart Pricing'}
      </button>

      {error && <p className="text-red-500">{error}</p>}

      {pricing && (
        <div className="pricing-results mt-6">
          <h3>Pricing Results</h3>
          <p>Base Price: ${pricing.base_price.toFixed(2)}</p>
          <p>Confidence Score: {pricing.confidence_score}%</p>
          <p>Market Rate: ${pricing.market_rate.toFixed(2)}</p>
          <p>
            Price Range: ${pricing.price_range.min.toFixed(2)} -${' '}
            {pricing.price_range.max.toFixed(2)}
          </p>
          <div>
            <h4>AI Recommendations</h4>
            <p>{pricing.ai_recommendations}</p>
          </div>
          <div>
            <h4>Supplier Quotes</h4>
            {pricing.supplier_quotes.map((quote, idx) => (
              <div key={idx}>
                <p>
                  {quote.supplier}: ${quote.price.toFixed(2)} ({quote.availability})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
};
```

---

## Best Practices

### 1. Error Handling

```typescript
// Always wrap async operations in try-catch
try {
  await supabase.from('table').select();
} catch (error) {
  if (error instanceof Error) {
    console.error('Error details:', error.message);
  }
}
```

### 2. Performance Optimization

```typescript
// Use useCallback to memoize functions
import { useCallback } from 'react';

const fetchEstimates = useCallback(async (companyId: string) => {
  return await supabase
    .from('estimates')
    .select('*')
    .eq('company_id', companyId);
}, []);
```

### 3. Security Best Practices

- **Never expose API keys**: Use environment variables
- **Row-level security (RLS)**: Enable RLS policies in Supabase
- **Input validation**: Always validate user input before sending to database
- **Use parameterized queries**: Supabase SDK handles this automatically

### 4. Testing

Create `src/__tests__/smartPricing.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { smartPricingService } from '../services/smartPricingService';

describe('Smart Pricing Service', () => {
  it('should generate pricing for a service request', async () => {
    const mockResponse = {
      base_price: 1500,
      confidence_score: 85,
      market_rate: 1600,
      supplier_quotes: [],
      ai_recommendations: 'Recommended pricing is competitive',
      price_range: { min: 1200, max: 1800 },
    };

    vi.spyOn(smartPricingService, 'generatePricing').mockResolvedValue(
      mockResponse
    );

    const result = await smartPricingService.generatePricing({
      service_type: 'Septic Tank Replacement',
      location: 'Denver, CO',
      description: 'Replace 1000 gallon tank',
      complexity: 'medium',
    });

    expect(result.base_price).toBe(1500);
    expect(result.confidence_score).toBe(85);
  });
});
```

### 5. TypeScript Best Practices

```typescript
// Always define interfaces for data models
interface Estimate {
  id: string;
  company_id: string;
  // ... other fields
}

// Use strict null checking
const estimate: Estimate | null = null;
if (estimate) {
  // Safe to access estimate properties
}
```

---

## Troubleshooting

### Common Issues

**Issue**: "CORS error when calling Edge Functions"
- **Solution**: Check that your Supabase project URL matches in `.env.local`
- Ensure Edge Functions are deployed to your Supabase project

**Issue**: "Authentication state not persisting"
- **Solution**: Verify `useAuth` hook is called before component mount
- Check browser storage permissions in settings

**Issue**: "Real-time subscriptions not updating"
- **Solution**: Ensure RLS policies allow real-time broadcasts
- Verify row filters in subscription match actual table structure

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)
- [ManyHats Pro Smart Pricing Engine](./SMART_PRICING_ENGINE.md)

---

**Last Updated**: July 6, 2026
**Maintained By**: ManyHats Development Team
