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
        // Use implicit flow (the default for browser clients).
        // Tokens are returned in the URL hash and detectSessionInUrl picks them up.
        flowType: 'implicit',
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
    console.error('Failed to upload avatar: No active session', sessionError);
    throw new Error('You must be logged in to upload an avatar image');
  }
  
  // Include user ID in path for proper access control
  const userId = session.user.id;
  const filePath = `${userId}/${imageId}.png`;
  
  const { data, error } = await supabase
    .storage
    .from('avatar-images-bucket')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: true,
    });
    
  if (error) {
    console.error(`Failed to upload avatar image "${filePath}":`, error);
    throw error;
  }
  
  // Get the public URL
  const { data: publicURLData } = supabase
    .storage
    .from('avatar-images-bucket')
    .getPublicUrl(filePath);
  
  return {
    path: data.path,
    publicUrl: publicURLData.publicUrl,
  };
}

// Helper to check if the current user is an admin
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  // Verify we have an active session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error('Failed to check admin status: No active session', sessionError);
    return false;
  }
  
  // Query user_profiles table for is_admin
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('user_id', session.user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown };
  
  if (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
  
  return data?.is_admin === true;
}

// Helper to upload a new avatar photo and generate a Hedra avatar
export async function uploadAndGenerateAvatar(file: File, sessionId: string) {
  const supabase = getSupabaseClient();
  
  // Get session for auth header
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error('Failed to generate avatar: No active session', sessionError);
    throw new Error('You must be logged in to generate an avatar');
  }
  
  // Build form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);
  
  // Call the API route (which proxies to the Flask backend)
  const response = await fetch('/api/upload-avatar', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('Failed to generate avatar:', data);
    throw new Error(data.error || 'Failed to generate avatar');
  }
  
  return data;
}

