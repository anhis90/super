const SUPABASE_URL = 'https://hhhyexgsfflzzsflpsqs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWNhYmFzZSIsInJlZiI6ImhoaHlleGdzZmZsenpzZmxwc3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjA5MzIsImV4cCI6MjA5MTA5NjkzMn0.7N1jk0fWkvL3Snfd-AHyiNavVhNSGUOAQLp6MeUY4ZI';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabase = supabaseClient;
