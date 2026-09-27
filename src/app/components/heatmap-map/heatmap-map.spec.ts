import { toHeatPoints } from './heatmap-map';

describe('toHeatPoints', () => {
  it('renders cells as latitude, longitude and intensity tuples', () => {
    expect(
      toHeatPoints([
        { latitude: 45.4005, longitude: 9.1005, count: 4, intensity: 1 },
        { latitude: 45.4015, longitude: 9.1015, count: 2, intensity: 0.5 },
      ]),
    ).toEqual([
      [45.4005, 9.1005, 1],
      [45.4015, 9.1015, 0.5],
    ]);
  });

  it('handles an empty response', () => {
    expect(toHeatPoints([])).toEqual([]);
  });
});
