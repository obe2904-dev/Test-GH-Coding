/**
 * Channel Segment Helpers
 * 
 * Purpose: Derive channel segments from business operations flags
 * This avoids data duplication - channels are computed from existing data, not stored separately
 * 
 * Date: July 8, 2026
 * Phase: Segment Decomposition Phase 5
 */

import type { ChannelSegmentKey } from './brand-profile/audience-profile.ts'

export interface BusinessChannelContext {
  accepts_walk_ins?: boolean
  has_takeaway?: boolean
  has_delivery?: boolean
  reservation_required?: boolean
  booking_link?: string | null
}

/**
 * Derive channel segments from business operations flags and booking link
 * 
 * Logic:
 * - walk_in: Default if accepts_walk_ins !== false (most businesses accept walk-ins)
 * - booking: If booking_link exists OR reservation_required is true
 * - takeaway: If has_takeaway is true
 * - delivery: If has_delivery is true
 * 
 * Returns: Array of available channels (minimum 1, maximum 4)
 * 
 * Examples:
 * - Casual cafe: ['walk_in', 'takeaway']
 * - Fine dining: ['booking'] (reservation_required = true, accepts_walk_ins = false)
 * - Pizza place: ['walk_in', 'takeaway', 'delivery']
 * - Restaurant with online booking: ['walk_in', 'booking', 'takeaway']
 */
export function deriveChannelSegments(context: BusinessChannelContext): ChannelSegmentKey[] {
  const channels: ChannelSegmentKey[] = []
  
  // Walk-in: Default behavior unless explicitly disabled
  // Most businesses accept walk-ins (casual cafes, bars, quick service)
  if (context.accepts_walk_ins !== false && !context.reservation_required) {
    channels.push('walk_in')
  }
  
  // Booking: If booking link exists OR reservation required
  // Fine dining restaurants may disable walk-ins and require booking
  if (context.booking_link || context.reservation_required) {
    channels.push('booking')
  }
  
  // Takeaway: If explicitly enabled
  if (context.has_takeaway) {
    channels.push('takeaway')
  }
  
  // Delivery: If explicitly enabled
  if (context.has_delivery) {
    channels.push('delivery')
  }
  
  // Fallback: If no channels detected, default to walk_in
  // This handles edge cases where all flags are false/null
  if (channels.length === 0) {
    channels.push('walk_in')
  }
  
  return channels
}

/**
 * Check if a specific channel is available for a business
 * 
 * Example usage:
 * ```typescript
 * if (isChannelAvailable(businessContext, 'delivery')) {
 *   // Show delivery CTA
 * }
 * ```
 */
export function isChannelAvailable(
  context: BusinessChannelContext,
  channel: ChannelSegmentKey
): boolean {
  const availableChannels = deriveChannelSegments(context)
  return availableChannels.includes(channel)
}

/**
 * Get the primary channel for a business (first in priority order)
 * 
 * Priority:
 * 1. booking (if reservation required - forces this as primary)
 * 2. walk_in (if available - most common)
 * 3. takeaway (if walk_in not available)
 * 4. delivery (fallback)
 */
export function getPrimaryChannel(context: BusinessChannelContext): ChannelSegmentKey {
  // If reservation required, booking is primary
  if (context.reservation_required || context.booking_link) {
    return 'booking'
  }
  
  // Otherwise walk_in is default primary
  if (context.accepts_walk_ins !== false && !context.reservation_required) {
    return 'walk_in'
  }
  
  // Fallback to first available
  const channels = deriveChannelSegments(context)
  return channels[0] || 'walk_in'
}
