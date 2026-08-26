import { subtitleDisplayName, UNNAMED_SUBTITLE } from '../display-name';

describe('subtitleDisplayName', () => {
  it('prefers a plausible reported name', () => {
    expect(subtitleDisplayName('content://whatever/1', 'Movie.en.srt')).toBe('Movie.en.srt');
  });

  // The bug this exists for: MediaStore ids were rendering as the track title.
  it('refuses a MediaStore document id from either source', () => {
    const uri = 'content://com.android.providers.media.documents/document/msf%3A345000';
    expect(subtitleDisplayName(uri, 'msf:345000')).toBe(UNNAMED_SUBTITLE);
    expect(subtitleDisplayName(uri)).toBe(UNNAMED_SUBTITLE);
  });

  it('digs the basename out of an external-storage document id', () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3AMovies%2FA.Good.Girl.srt';
    expect(subtitleDisplayName(uri, 'primary:Movies/A.Good.Girl.srt')).toBe('A.Good.Girl.srt');
  });

  it('handles an ordinary file URI', () => {
    expect(subtitleDisplayName('file:///storage/emulated/0/Movies/Foo.en.srt')).toBe('Foo.en.srt');
  });

  it('percent-decodes spaces in a file URI', () => {
    expect(subtitleDisplayName('file:///storage/emulated/0/A%20Good%20Girl.srt')).toBe(
      'A Good Girl.srt',
    );
  });

  it('falls back when there is no extension to trust', () => {
    expect(subtitleDisplayName('content://provider/document/12345')).toBe(UNNAMED_SUBTITLE);
  });

  it('survives a malformed percent-escape', () => {
    expect(subtitleDisplayName('content://provider/document/%zz')).toBe(UNNAMED_SUBTITLE);
  });
});
