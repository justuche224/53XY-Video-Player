import { captureMoment, type CaptureDeps, type CaptureInput } from '../capture';
import type { GrabFrameOptions } from '../../../modules/frame-grabber/src/FrameGrabberModule';
import type { Moment } from '../types';

const video = {
  id: 'v1',
  uri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies',
  durationMs: 2_580_000,
};

const input: CaptureInput = { video, positionMs: 2_472_000, note: 'Denny gets the case' };

function deps(overrides: Partial<CaptureDeps> = {}) {
  const inserted: Moment[] = [];
  const base: CaptureDeps = {
    // `opts` must be annotated: the repo typechecks tests, and an inferred
    // parameter here trips noImplicitAny.
    grabFrame: jest.fn(async (_uri: string, opts: GrabFrameOptions) => ({
      uri: opts.outPath,
      positionMs: 2_472_000,
      score: 0.5,
    })),
    insert: jest.fn(async (m: Moment) => {
      inserted.push(m);
    }),
    syncManifest: jest.fn(async () => {}),
    momentsDir: 'file:///storage/emulated/0/53XY/Moments',
    now: () => 1_757_000_000_000,
    newId: () => 'm1',
    ...overrides,
  };
  return { deps: base, inserted };
}

describe('captureMoment', () => {
  it('builds a full snapshot from the video and the grabbed frame', async () => {
    const { deps: d, inserted } = deps();
    const moment = await captureMoment(input, d);

    expect(moment).toEqual({
      id: 'm1',
      videoId: 'v1',
      positionMs: 2_472_000,
      createdAt: 1_757_000_000_000,
      frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
      note: 'Denny gets the case',
      title: 'Boston Legal',
      episodeLabel: 'S02E14',
      filename: 'Boston.Legal.S02E14.mkv',
      folder: 'Movies',
      videoUri: video.uri,
      durationMs: 2_580_000,
    });
    expect(inserted).toEqual([moment]);
  });

  it('asks for exactly this frame, not a nearby keyframe', async () => {
    const { deps: d } = deps();
    await captureMoment(input, d);

    expect(d.grabFrame).toHaveBeenCalledWith(video.uri, {
      positionsMs: [2_472_000],
      targetWidth: 1280,
      minScore: 0,
      quality: 0.9,
      exact: true,
      outPath: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    });
  });

  it('still saves the moment when the frame grab finds nothing', async () => {
    const { deps: d, inserted } = deps({ grabFrame: jest.fn(async () => null) });
    const moment = await captureMoment(input, d);

    expect(moment.frameUri).toBeNull();
    expect(moment.positionMs).toBe(2_472_000);
    expect(inserted).toHaveLength(1);
  });

  it('still saves the moment when the frame grab throws', async () => {
    const { deps: d, inserted } = deps({
      grabFrame: jest.fn(async () => {
        throw new Error('decoder gone');
      }),
    });
    const moment = await captureMoment(input, d);

    expect(moment.frameUri).toBeNull();
    expect(inserted).toHaveLength(1);
  });

  it('survives a failed manifest write, since the row is already saved', async () => {
    const { deps: d } = deps({
      syncManifest: jest.fn(async () => {
        throw new Error('read-only fs');
      }),
    });
    await expect(captureMoment(input, d)).resolves.toMatchObject({ id: 'm1' });
  });

  it('stores an empty subtitle line as no note rather than an empty string', async () => {
    const { deps: d } = deps();
    const moment = await captureMoment({ ...input, note: '   ' }, d);
    expect(moment.note).toBeNull();
  });

  it('propagates a failed insert, because nothing was saved', async () => {
    const { deps: d } = deps({
      insert: jest.fn(async () => {
        throw new Error('db locked');
      }),
    });
    await expect(captureMoment(input, d)).rejects.toThrow('db locked');
  });
});
