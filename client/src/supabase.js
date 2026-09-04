let clientPromise = null;

export async function getSupabase() {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const res = await fetch('/api/config/public');
    const cfg = await res.json();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw new Error('Supabase Google login is not configured yet');
    }
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  })();
  return clientPromise;
}
