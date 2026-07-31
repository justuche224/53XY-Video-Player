/**
 * Order for the background thumbnail sweep: videos the user played most
 * recently first (they are the likeliest to be looked at again), then the rest
 * in library order. Only videos in `pending` are included, and never twice.
 */
export function buildSweepQueue(
  videos: { id: string }[],
  pending: Set<string>,
  recentIds: string[],
): string[] {
  const inLibrary = new Set(videos.map((v) => v.id));
  const queued = new Set<string>();
  const queue: string[] = [];

  const push = (id: string) => {
    if (!pending.has(id) || queued.has(id) || !inLibrary.has(id)) return;
    queued.add(id);
    queue.push(id);
  };

  for (const id of recentIds) push(id);
  for (const video of videos) push(video.id);

  return queue;
}
