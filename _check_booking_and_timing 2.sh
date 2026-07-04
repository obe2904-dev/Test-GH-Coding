#!/bin/bash

# Check current booking settings and decision timing for Cafe Faust

BUSINESS_ID="f4679fa9-3120-4a59-9506-d059b010c34a"

echo "=== CHECKING BUSINESS OPERATIONS ==="
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgzMDM1NjYsImV4cCI6MjA0Mzg3OTU2Nn0.ZJUQss0zY4msuxR5v5i_PNwRmGYOCeJpz6j1iZJLaHw" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00" \
  -H "Content-Type: application/json" \
  --data "{\"query\":\"SELECT business_id, name, reservation_required, accepts_walkins FROM business_operations WHERE business_id = '$BUSINESS_ID'\"}"

echo -e "\n\n=== CHECKING DECISION TIMING IN V5 ===" 
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgzMDM1NjYsImV4cCI6MjA0Mzg3OTU2Nn0.ZJUQss0zY4msuxR5v5i_PNwRmGYOCeJpz6j1iZJLaHw" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00" \
  -H "Content-Type: application/json" \
  --data "{\"query\":\"SELECT programme_name, decision_timing, baseline_goal_split FROM business_programme_profiles WHERE business_id = '$BUSINESS_ID' ORDER BY created_at DESC\"}"
