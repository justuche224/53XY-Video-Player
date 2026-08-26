import { disambiguateLabels } from '../disambiguate-labels';

describe('disambiguateLabels', () => {
  it('numbers repeated labels in order', () => {
    expect(disambiguateLabels(['English', 'English'])).toEqual(['English (1)', 'English (2)']);
  });

  it('leaves unique labels untouched', () => {
    expect(disambiguateLabels(['English', 'French'])).toEqual(['English', 'French']);
  });

  it('numbers only the labels that actually repeat', () => {
    expect(disambiguateLabels(['English', 'French', 'English', 'German'])).toEqual([
      'English (1)',
      'French',
      'English (2)',
      'German',
    ]);
  });

  it('handles an empty list', () => {
    expect(disambiguateLabels([])).toEqual([]);
  });
});
