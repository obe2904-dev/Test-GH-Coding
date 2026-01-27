#!/bin/bash

# Execute Concept Fit Migration
# This creates the business_concept_fit tables

echo "🗄️  Executing Concept Fit Migration..."
echo ""

# Use psql to execute the migration
PGPASSWORD="postgres" psql \
  -h "aws-0-eu-central-1.pooler.supabase.com" \
  -p "6543" \
  -U "postgres.kvqdkohdpvmdylqgujpn" \
  -d "postgres" \
  -f "supabase/migrations/20260124000000_create_concept_fit_tables.sql"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration executed successfully!"
  echo ""
  echo "Tables created:"
  echo "  - business_concept_fit"
  echo "  - business_concept_fit_multi"
  echo ""
  echo "You can now test the concept fit analysis at:"
  echo "  http://localhost:3000/dashboard/test-concept-fit"
else
  echo ""
  echo "❌ Migration failed. Please check the error above."
  echo ""
  echo "Alternative: Copy the SQL and run it manually in Supabase SQL Editor:"
  echo "  https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql"
fi
