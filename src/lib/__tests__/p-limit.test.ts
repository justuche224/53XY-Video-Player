import { pLimit } from '../p-limit';

describe('pLimit', () => {
  it('never exceeds the concurrency cap and returns results', async () => {
    const limit = pLimit(2);
    let active = 0;
    let maxActive = 0;
    const task = () =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return 'ok';
      });
    const results = await Promise.all([task(), task(), task(), task(), task()]);
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
