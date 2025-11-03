import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  
  return supabaseClient;
}

// Helper to get current user session
export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Failed to get user:', error.message);
    return null;
  }
  
  return user;
}

// Helper to sign out
export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out failed:', error.message);
  }
  
  localStorage.removeItem('supabase_user');
  
  return error;
}

// Helper to upload avatar image to Supabase Storage
export async function uploadAvatarImage(imageId: string, blob: Blob) {
  const supabase = getSupabaseClient();
  
  // Verify we have an active session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error('Failed to upload avatar: No active session');
    throw new Error('You must be logged in to upload an avatar image');
  }
  
  const filePath = `${imageId}.png`;
  
  const { data, error } = await supabase
    .storage
    .from('avatar-images')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: true,
    });
    
  if (error) {
    console.error('Failed to upload avatar image:', error.message);
    throw error;
  }
  
  // Get the public URL
  const { data: publicURLData } = supabase
    .storage
    .from('avatar-images')
    .getPublicUrl(filePath);
  
  return {
    path: data.path,
    publicUrl: publicURLData.publicUrl,
  };
}

