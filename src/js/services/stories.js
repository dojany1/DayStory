/* ============================================
   DayStory — Story Service (Supabase)
   ============================================ */
import { supabase } from '../supabase.js';
import { DEMO_STORIES } from '../data/demo.js';

/* Fallback: use demo data if DB query fails or returns empty */
function fallbackToDemo(dbData) {
  return dbData && dbData.length > 0 ? dbData : DEMO_STORIES;
}

/* Fetch all published stories, ordered by publish_date desc */
export async function fetchStories() {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('status', 'published')
    .order('publish_date', { ascending: false });
  return fallbackToDemo(data);
}

/* Fetch today's story */
export async function fetchTodayStory() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('stories')
    .select('*')
    .eq('status', 'published')
    .eq('publish_date', today)
    .single();
  if (data) return data;

  /* Fallback: latest published */
  const { data: latest } = await supabase
    .from('stories')
    .select('*')
    .eq('status', 'published')
    .order('publish_date', { ascending: false })
    .limit(1)
    .single();
  if (latest) return latest;

  /* Final fallback: demo */
  const demoToday = DEMO_STORIES.find(s => s.publish_date === today);
  return demoToday || DEMO_STORIES[DEMO_STORIES.length - 1];
}

/* Fetch story by ID */
export async function fetchStoryById(id) {
  const { data, error } = await supabase
    .from('stories')
    .select('*, story_sources(*)')
    .eq('id', id)
    .single();
  if (data) return data;

  /* Fallback to demo */
  return DEMO_STORIES.find(s => s.id === id) || null;
}

/* Search stories */
export async function searchStoriesDB(query) {
  const q = `%${query}%`;
  const { data } = await supabase
    .from('stories')
    .select('*')
    .eq('status', 'published')
    .or(`title.ilike.${q},body.ilike.${q},figure_name.ilike.${q},country.ilike.${q}`)
    .order('publish_date', { ascending: false });
  if (data && data.length > 0) return data;

  /* Fallback */
  const lq = query.toLowerCase();
  return DEMO_STORIES.filter(s =>
    s.title.toLowerCase().includes(lq) ||
    s.body.toLowerCase().includes(lq) ||
    s.figure_name.toLowerCase().includes(lq) ||
    s.country.toLowerCase().includes(lq)
  );
}

/* ---- Editor CRUD ---- */

/* Fetch all stories for editor (all statuses) */
export async function fetchAllStoriesEditor() {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .order('publish_date', { ascending: false });
  return data || [];
}

/* Create story */
export async function createStory(story) {
  const { data, error } = await supabase
    .from('stories')
    .insert(story)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Update story */
export async function updateStory(id, updates) {
  const { data, error } = await supabase
    .from('stories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Delete story */
export async function deleteStory(id) {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* Publish story */
export async function publishStory(id) {
  return updateStory(id, { status: 'published', published_at: new Date().toISOString() });
}
