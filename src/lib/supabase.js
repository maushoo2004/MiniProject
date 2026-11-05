import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured =
  /^https:\/\/.+\.supabase\.co/.test(supabaseUrl) && supabaseAnonKey.length > 20;

// A placeholder keeps the app from crashing so we can show a friendly setup screen instead.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key"
);

const BUCKET = "blog-images";

export const uploadImage = async (file, userId) => {
  try {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    return { url: publicUrl, path: filePath, error: null };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { url: null, path: null, error };
  }
};

/** Turns a stored public URL back into its storage path (for deleting). */
export const storagePathFromUrl = (url) => {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
};

export const deleteImage = async (filePath) => {
  if (!filePath) return { success: true, error: null };
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) console.error("Error deleting image:", error);
  return { success: !error, error };
};

/** Shared post-row → UI shape mapping */
export const mapPost = (post) => ({
  id: post.id,
  title: post.title,
  content: post.content,
  excerpt: post.excerpt || post.content.slice(0, 150) + (post.content.length > 150 ? "..." : ""),
  image_url: post.image_url,
  author: post.profiles?.name || "Unknown",
  authorId: post.author_id,
  created_at: post.created_at,
  updated_at: post.updated_at,
  // comments(count) comes back as [{ count: N }] (only comments this viewer is allowed to see)
  commentCount: post.comments?.[0]?.count ?? 0,
  readMinutes: readingMinutes(post.content),
});

/** Reading time at ~200 words per minute (at least 1). */
export function readingMinutes(content) {
  const words = (content || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const POST_SELECT = "*, profiles:author_id (id, name), comments(count)";
