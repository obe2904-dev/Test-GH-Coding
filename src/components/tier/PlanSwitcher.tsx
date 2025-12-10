// path: src/components/tier/PlanSwitcher.tsx
import { useEffect, useMemo, useState } from 'react'
import { useTierStore, type Tier } from '../../stores/tierStore'
import { supabase } from '../../lib/supabase'

/**
 * Why this shape:
 * - Your generated Database types don't include `profiles.plan` yet.
 * - We cast Supabase to `any` locally to bypass column inference until the DB/types are updated.
 * - When the column exists and types are regenerated, remove casts and use strict typing.
 */

type PlanSource = 'dev' | 'supabase'

interface PlanSwitcherProps {
  source?: PlanSource        // 'dev' for local override; switch to 'supabase' once profiles.plan exists
  writeBack?: boolean        // if true and source === 'supabase', attempt UPDATE profiles.plan on switch
  className?: string
}

const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  standardplus: 'Smart',
  premium: 'Pro',
}

const STORAGE_KEY = 'dev:tier'

// Loose client to avoid TS errors while plan column isn't in types
const sbLoose: any = supabase

async function readPlanFromSupabase(): Promise<Tier | null> {
  try {
    const { data: sessionRes } = await sbLoose.auth.getSession()
    const userId: string | undefined = sessionRes?.session?.user?.id
    if (!userId) return null

    // Get user's business (as owner)
    const { data: business, error: businessError } = await sbLoose
      .from('businesses')
      .select('plan')
      .eq('owner_id', userId)
      .maybeSingle()

    if (!businessError && business?.plan) {
      const normalized = business.plan.toLowerCase()
      if (['free', 'standardplus', 'premium'].includes(normalized)) {
        return normalized as Tier
      }
    }

    // If not owner, check if team member
    const { data: membership } = await sbLoose
      .from('business_team_members')
      .select('business_id')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .maybeSingle()

    if (membership?.business_id) {
      const { data: teamBusiness } = await sbLoose
        .from('businesses')
        .select('plan')
        .eq('id', membership.business_id)
        .single()

      if (teamBusiness?.plan) {
        const normalized = teamBusiness.plan.toLowerCase()
        if (['free', 'standardplus', 'premium'].includes(normalized)) {
          return normalized as Tier
        }
      }
    }

    return null
  } catch {
    return null
  }
}

async function writePlanToSupabase(next: Tier): Promise<void> {
  try {
    const { data: sessionRes } = await sbLoose.auth.getSession()
    const userId: string | undefined = sessionRes?.session?.user?.id
    if (!userId) return

    // Update plan on user's business (owners only can change plan)
    await sbLoose.from('businesses').update({ plan: next }).eq('owner_id', userId)
  } catch {
    // dev-only: ignore
  }
}

export default function PlanSwitcher({ source = 'dev', writeBack = false, className = '' }: PlanSwitcherProps) {
  const { currentTier, setTier } = useTierStore((s) => ({ currentTier: s.currentTier, setTier: s.setTier }))
  const [loading, setLoading] = useState(source === 'supabase')

  // Initial sync: Supabase → store OR localStorage → store
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (source === 'supabase') {
        setLoading(true)
        const remote = await readPlanFromSupabase()
        if (mounted && remote) {
          setTier(remote)
          localStorage.setItem(STORAGE_KEY, remote)
        } else if (mounted) {
          const cached = localStorage.getItem(STORAGE_KEY) as Tier | null
          if (cached === 'free' || cached === 'standardplus' || cached === 'premium') {
            setTier(cached)
          }
        }
        setLoading(false)
      } else {
        const cached = localStorage.getItem(STORAGE_KEY) as Tier | null
        if (cached === 'free' || cached === 'standardplus' || cached === 'premium') {
          setTier(cached)
        }
      }
    })()
    return () => { mounted = false }
  }, [source, setTier])

  const buttons = useMemo(() => (['free','standardplus','premium'] as const), [])

  const handleSelect = async (next: Tier) => {
    setTier(next)
    localStorage.setItem(STORAGE_KEY, next)
    if (source === 'supabase' && writeBack) {
      await writePlanToSupabase(next)
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-slate-500">Plan</div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-[#6B7280]">
          {source === 'dev' ? 'DEV' : (loading ? 'Syncing…' : 'Supabase')}
        </span>
      </div>

      <div className="grid grid-cols-3 rounded-xl border border-slate-200 overflow-hidden">
        {buttons.map((key) => {
          const active = currentTier === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={[
                'px-3 py-1.5 text-sm transition-all',
                'focus:outline-none focus-visible:ring',
                active ? 'bg-slate-900 text-white' : 'bg-white text-[#1F2937] hover:bg-slate-50',
                'border-r last:border-r-0 border-slate-200',
              ].join(' ')}
              aria-pressed={active}
            >
              {TIER_LABELS[key]}
            </button>
          )
        })}
      </div>
    </div>
  )
}