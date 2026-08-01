import { Image } from 'react-native';

let _task     = null;
let _fetching = false;

export async function prefetchNextTask(supabase) {
  if (_fetching || _task) return;
  _fetching = true;
  try {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'active');
    if (!count) return;

    const idx = Math.floor(Math.random() * count);
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('approval_status', 'active')
      .range(idx, idx)
      .single();
    if (!data) return;

    // Best-effort image warm-up (helps on Android; iOS cache varies)
    await Promise.all([
      Image.prefetch(data.real_image_url),
      Image.prefetch(data.ai_image_url),
    ]).catch(() => {});

    _task = data;
    return _task;
  } catch (_) {
    return null; // GameplayScreen falls back to live fetch
  } finally {
    _fetching = false;
  }
}

export function consumeCachedTask() {
  const t = _task;
  _task = null;
  return t;
}
