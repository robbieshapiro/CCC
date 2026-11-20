// Reginald's word while a screen loads (Nov 18): one short, useful or little-known thing about the club. Every line is
// true to the code it describes (the drinks in golf3d/clubs.ts, the money in bonus.ts and purse.ts).
export const TIPS = [
  'There’s a cooler by the 1st tee, if you look. An Espresso makes the gold twice as wide.',
  'A Clubhouse Lager sends it 25% further, but the wind moves it twice as much. Choose your hole.',
  'Stuck in the rough? A Transfusion plays rough and sand like fairway.',
  'Sparkling Water cuts the wind to a quarter. Worth it on a gusty day.',
  'An Arnold Palmer halves the needle’s speed. Slow hands, steady card.',
  'Design a course at the Design Desk. Once it’s on, you earn $50 every time a challenger fails to beat you.',
  'Everyone plays the same pin and the same wind today. No excuses at the bar.',
  'Three cards a day. Your best one counts.',
  'An eagle pays $500, an ace $2,500. Aim accordingly.',
  'A chip-in from off the green pays $100.',
  'Holed from 60 feet? That’s a monster putt, and $200.',
  'Every hole has a secret route. Find one for $150.',
  'The Ace Pot carries over until someone holes it.',
  'Closest to the Pin pays the day’s top three: $300, $150, $75.',
  'At the Target Range, a ball must land in the ring on the fly. A roll-in only gets the outer ring.',
  'The back net at the Target Range pays 40 for a drive through its gold window.',
  'Score again on the next ball at the Target Range and it doubles.',
  'Tap Flyover on the tee to see the whole hole before you swing.',
  'Make an eagle and your shot goes up on home, for the whole club to watch.',
  'Post a counted card every week and the club pays you $250.',
  'Next week’s course opens for practice on Thursday.',
];

// a random start, then round from there
export function tipsFrom() {
  let i = Math.floor(Math.random() * TIPS.length);
  return () => TIPS[i++ % TIPS.length];
}
