#!/bin/bash

# Quick migration script to add category_scores column
# Requires: DATABASE_URL environment variable or Supabase CLI

echo "🔧 Adding category_scores column to business_location_intelligence..."

# Try with Supabase CLI if available
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db execute --sql "ALTER TABLE business_location_intelligence ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '{}'::jsonb;"
else
    echo "⚠️  Supabase CLI not found."
    echo ""
    echo "Please run this SQL manually in Supabase Dashboard:"
    echo "https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new"
    echo ""
    echo "SQL to run:"
    echo "----------------------------------------"
    cat ADD_CATEGORY_SCORES_COLUMN.sql
    echo "----------------------------------------"
fi
