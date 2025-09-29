// frontend/js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';


const SUPABASE_URL = "https://okulnfrlydegkyujpssj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdWxuZnJseWRlZ2t5dWpwc3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwODg2MjAsImV4cCI6MjA3NDY2NDYyMH0.j0vsvYfpOu0EcbtjGGVgJBCwp1LvWeLiKDALjmdFo4o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);