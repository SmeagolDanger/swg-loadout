export const COLORS = {
  spawns: '#7dd3fc',
  selected: '#facc15',
  patrol: '#34d399',
  statics: '#f472b6',
  minorStations: '#c084fc',
  majorStations: '#fb7185',
  beacons: '#f59e0b',
  asteroids: '#94a3b8',
  path: '#fde047',
};

export const PROJECTIONS = [
  { id: 'xy', label: 'Top (X / Y)', axes: [0, 1] },
  { id: 'xz', label: 'Front (X / Z)', axes: [0, 2] },
  { id: 'yz', label: 'Side (Y / Z)', axes: [1, 2] },
];

export const LAYER_OPTIONS = [
  ['spawns', 'Show spawners'],
  ['statics', 'Show static ships'],
  ['minorStations', 'Show minor stations'],
  ['majorStations', 'Show major stations'],
  ['beacons', 'Show beacons'],
  ['asteroids', 'Show asteroids'],
];

export const LEGEND_ITEMS = [
  ['Spawners', 'spawns', 'Satellite'],
  ['Selected spawners', 'selected', 'Satellite'],
  ['Static ships', 'statics', 'Boxes'],
  ['Major stations', 'majorStations', 'Disc3'],
  ['Beacons', 'beacons', 'Radio'],
  ['Asteroids', 'asteroids', 'Orbit'],
];
