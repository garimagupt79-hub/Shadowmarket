import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xjsxryciyfmvlhadpuqj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqc3hyeWNpeWZtdmxoYWRwdXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MzE2NDksImV4cCI6MjEwNTMwNzY0OX0.bEWiT-A2s3UPG-MmF4VM4GNs-emNz9o1msSlUgfieEM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
