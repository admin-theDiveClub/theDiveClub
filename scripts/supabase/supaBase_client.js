// Initialize Supabase client (avoid redeclaring global 'supabase')
const { createClient } = window.supabase;
const supabaseUrl = 'https://db.thediveclub.org';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdmx3dXRudW91eW51a290ZGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2OTgyMzEsImV4cCI6MjA1NTI3NDIzMX0.qyEDq8w67G2BMfyHO7Iyvd3nFUSd0sulJhGl0eGkbfA';

// Reuse existing client if present; otherwise create and attach to a single global
if (!window.supabaseClient) {
	window.supabaseClient = createClient(supabaseUrl, supabaseKey);
}

// Optional: provide a safe alias without overwriting the library namespace
// Consumers should prefer 'window.supabaseClient' instead of a bare 'supabase' variable.

