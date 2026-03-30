/* ============================================
   DayStory — Bookmark Service (Supabase)
   ============================================ */
import { supabase } from '../supabase.js';
import { getState } from '../state.js';

/* Check if story is bookmarked */
export async function isBookmarked(storyId) {
  const user = getState('user');
  if (!user) return false;
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('story_id', storyId)
    .single();
  return !!data;
}

/* Toggle bookmark */
export async function toggleBookmark(storyId) {
  const user = getState('user');
  if (!user) return { bookmarked: false };

  const existing = await isBookmarked(storyId);
  if (existing) {
    await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('story_id', storyId);
    return { bookmarked: false };
  } else {
    await supabase
      .from('bookmarks')
      .insert({ user_id: user.id, story_id: storyId });
    return { bookmarked: true };
  }
}

/* Get all bookmarked story IDs for current user */
export async function getBookmarkedStoryIds() {
  const user = getState('user');
  if (!user) return [];
  const { data } = await supabase
    .from('bookmarks')
    .select('story_id')
    .eq('user_id', user.id);
  return (data || []).map(b => b.story_id);
}

/* Get bookmarked stories with full details */
export async function getBookmarkedStories() {
  const user = getState('user');
  if (!user) return [];
  const { data } = await supabase
    .from('bookmarks')
    .select('story_id, stories(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return (data || []).map(b => b.stories).filter(Boolean);
}

/* Get bookmark count for current user */
export async function getBookmarkCount() {
  const user = getState('user');
  if (!user) return 0;
  const { count } = await supabase
    .from('bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  return count || 0;
}
