export type Feat = { id: string; name: string; icon: string; how: string };

export const FEATS: Feat[] = [
  { id: 'ace', name: 'Hole in One', icon: '⛳', how: 'Ace any hole' },
  { id: 'chipin', name: 'Wedge Hole-out', icon: '🪶', how: 'Hole out with the wedge' },
  { id: 'cartpath', name: 'Cart Path Bank', icon: '🛞', how: 'Ride the cart path on The Azalea' },
  { id: 'bridge', name: 'Over the Bridge', icon: '🌉', how: 'Fly the gap on The Island' },
  { id: 'terrace', name: 'Terrace Route', icon: '🏛️', how: 'Take the veranda on The Clubhouse' },
  { id: 'runway', name: 'Cart Path Special', icon: '🛣️', how: 'Ride the cart path down The Summit' },
  { id: 'plank', name: 'Walk the Plank', icon: '🪵', how: 'Putt the boardwalk onto The Island' },
  { id: 'amphi', name: 'The Amphitheatre', icon: '🎭', how: 'Feed it off the bank behind The Ridge green' },
  { id: 'blowhole', name: 'Thar She Blows', icon: '🐋', how: 'Ride the blowhole on The Blowhole' },
  { id: 'lavatube', name: 'The Lava Tube', icon: '🌋', how: 'Roll the old lava tube across The Lava Field' },
  { id: 'rimroad', name: 'The Rim Road', icon: '🛤️', how: 'Take the long way round The Caldera' },
  { id: 'underpar', name: 'Under Par Round', icon: '📉', how: 'Finish a round under par' },
  { id: 'nineteenth', name: 'The Nineteenth Hole', icon: '🍹', how: 'Try all three drinks from the cart' },
  { id: 'champion', name: 'Club Champion', icon: '🏆', how: 'Win a month' },
];

export const featById = (id: string) => FEATS.find((f) => f.id === id);
