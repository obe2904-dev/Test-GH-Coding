#!/usr/bin/env node
// Backfill script to populate businesses.has_table_seating, menus, service_model
// Usage: VITE_SUPABASE_URL=... VITE_SUPABASE_SERVICE_KEY=... node scripts/backfill_business_capabilities.js

import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function detectMenusFromStructured(structured) {
  const menus = new Set()
  if (!structured) return []
  const categories = structured.categories || []
  for (const cat of categories) {
    const title = (cat.title || '').toLowerCase()
    if (title.includes('coffee') || title.includes('kaffe') || title.includes('espresso')) menus.add('coffee')
    if (title.includes('drink') || title.includes('drinks') || title.includes('cocktail') || title.includes('cocktails') || title.includes('vin') || title.includes('wine')) menus.add('drinks')
    if (title.includes('sandwich') || title.includes('salad') || title.includes('burger') || title.includes('pizza') || title.includes('middag') || title.includes('frokost') || title.includes('brunch') || title.includes('middag')) menus.add('food')
    if (title.includes('snack') || title.includes('dessert') || title.includes('kage') || title.includes('cookie')) menus.add('snacks')
    // items
    const items = cat.items || []
    for (const it of items) {
      const name = (it.name || '').toLowerCase()
      if (name.includes('kaffe') || name.includes('coffee') || name.includes('espresso')) menus.add('coffee')
      if (name.includes('sandwich') || name.includes('burger') || name.includes('pizza') || name.includes('sushi')) menus.add('food')
      if (name.includes('cocktail') || name.includes('vin') || name.includes('wine') || name.includes('øl') || name.includes('beer')) menus.add('drinks')
      if (name.includes('kage') || name.includes('dessert') || name.includes('cookie') || name.includes('snack')) menus.add('snacks')
    }
  }
  return Array.from(menus)
}

async function processBatch(offset = 0, limit = 100) {
  console.log(`Fetching businesses offset=${offset} limit=${limit}`)
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id')
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching businesses:', error)
    return false
  }

  if (!businesses || businesses.length === 0) return false

  for (const b of businesses) {
    const businessId = b.id
    try {
      // load operations
      const { data: ops } = await supabase
        .from('business_operations')
        .select('has_table_service, has_takeaway, has_delivery')
        .eq('business_id', businessId)
        .maybeSingle()

      const has_table_service = !!(ops && ops.has_table_service)
      const has_takeaway = !!(ops && ops.has_takeaway)
      const has_delivery = !!(ops && ops.has_delivery)

      // load latest menu_result structured_data
      const { data: menuRes } = await supabase
        .from('menu_results_v2')
        .select('structured_data')
        .eq('business_id', businessId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const structured = menuRes?.structured_data
      const detectedMenus = await detectMenusFromStructured(structured)

      // decide service_model
      let service_model = null
      if (has_table_service && (has_takeaway || has_delivery)) service_model = 'both'
      else if (has_table_service) service_model = 'dine-in'
      else if (has_takeaway && !has_delivery) service_model = 'takeaway'
      else if (has_delivery && !has_takeaway) service_model = 'delivery'
      else if (has_takeaway && has_delivery) service_model = 'takeaway+delivery'

      const updatePayload = {
        has_table_seating: has_table_service,
        menus: detectedMenus.length > 0 ? detectedMenus : null,
        service_model: service_model
      }

      // Update business
      const { error: updErr } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', businessId)

      if (updErr) {
        console.error('Failed to update business', businessId, updErr)
      } else {
        console.log('Updated', businessId, updatePayload)
      }
    } catch (e) {
      console.error('Error processing business', businessId, e)
    }
  }

  return businesses.length === limit
}

async function run() {
  let offset = 0
  const limit = 100
  while (true) {
    const more = await processBatch(offset, limit)
    if (!more) break
    offset += limit
  }
  console.log('Backfill complete')
}

run().catch(err => { console.error(err); process.exit(1) })
