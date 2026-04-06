import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// The URL and Anon Key are mapped from vite environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
