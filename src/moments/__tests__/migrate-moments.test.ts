import { planMomentMigration } from '../migrate-moments';
import type { Moment } from '../types';

const SHARED = 'file:///storage/emulated/0/53XY/Moments';
const PRIVATE = 'file:///data/user/0/com.jvstuche.fiftythreexy.dev/files/moments';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: `${PRIVATE}/m1.jpg`,
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: 'file:///storage/emulated/0/Movies/Lanterns.S01E03.mkv',
    durationMs: 2000,
    ...over,
  };
}

describe('planMomentMigration', () => {
  it('moves a frame that is not already in the target directory', () => {
    expect(planMomentMigration([moment()], SHARED)).toEqual([
      { id: 'm1', fromUri: `${PRIVATE}/m1.jpg`, toUri: `${SHARED}/m1.jpg` },
    ]);
  });

  it('skips a frame already in the target directory', () => {
    expect(planMomentMigration([moment({ frameUri: `${SHARED}/m1.jpg` })], SHARED)).toEqual([]);
  });

  it('skips a frameless moment — there is no file to move', () => {
    expect(planMomentMigration([moment({ frameUri: null })], SHARED)).toEqual([]);
  });

  it('names the destination from the moment id, not the old filename', () => {
    // A frame whose stored path drifted from the id convention must still land
    // where framePath() will look for it.
    const odd = moment({ id: 'm2', frameUri: `${PRIVATE}/legacy-name.jpg` });
    expect(planMomentMigration([odd], SHARED)).toEqual([
      { id: 'm2', fromUri: `${PRIVATE}/legacy-name.jpg`, toUri: `${SHARED}/m2.jpg` },
    ]);
  });

  it('plans every movable moment in one pass', () => {
    const plan = planMomentMigration(
      [moment({ id: 'a' }), moment({ id: 'b', frameUri: null }), moment({ id: 'c' })],
      SHARED,
    );
    expect(plan.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
