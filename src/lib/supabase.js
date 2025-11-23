import { createClient } from "@supabase/supabase-js";

// These will be set from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL and Anon Key must be set in environment variables"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Image upload utility functions
export const uploadImage = async (file, userId) => {
  try {
    // Debug: List all available buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    console.log('Available buckets:', buckets);
    if (listError) console.error('Error listing buckets:', listError);

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('Attempting to upload to blog-images bucket...');
    console.log('File path:', filePath);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("blog-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("blog-images").getPublicUrl(filePath);

    return { url: publicUrl, path: filePath, error: null };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { url: null, path: null, error };
  }
};

export const deleteImage = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from("blog-images")
      .remove([filePath]);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error("Error deleting image:", error);
    return { success: false, error };
  }
};

// Fetch report count for a user
export const getUserReportCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching report count:', error);
    return 0;
  }
};
