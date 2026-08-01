let _task     = null;
let _fetching = false;

export async function prefetchNextTask(supabase) {
  if (_fetching || _task) return _task;
  _fetching = true;
  try {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'active');
    if (!count) return null;

    const idx = Math.floor(Math.random() * count);
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('approval_status', 'active')
      .range(idx, idx)
      .single();
    if (!data) return null;

    // Set _task as soon as data arrives — the topmost pre-render in GameplayScreen
    // mounts immediately and handles image download + GPU decode on its own.
    // Waiting for Image.prefetch() here delays setNextTask by 1–5 s and starves
    // the pre-render of the time it needs to warm up before Next Pair is tapped.
    _task = data;
    return _task;
  } catch (_) {
    return null;
  } finally {
    _fetching = false;
  }
}

export function consumeCachedTask() {
  const t = _task;
  _task = null;
  return t;
}
