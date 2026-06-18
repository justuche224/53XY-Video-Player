import { neighbors } from '../playlist';
const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
describe('neighbors', () => {
  it('returns prev/next around the current item', () => {
    expect(neighbors(items, 'b')).toEqual({ prev: { id: 'a' }, next: { id: 'c' }, index: 1 });
  });
  it('nulls prev at the start and next at the end', () => {
    expect(neighbors(items, 'a').prev).toBeNull();
    expect(neighbors(items, 'c').next).toBeNull();
  });
  it('returns index -1 and null neighbors when absent', () => {
    expect(neighbors(items, 'z')).toEqual({ prev: null, next: null, index: -1 });
  });
});
