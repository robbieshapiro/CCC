// What Daisy says at the beverage cart: an opener, a word on your round, then the order.
// Each exchange is her line and two or three replies you can pick, each with her comeback.
import type { Drink } from './clubs';

export type Mood = 'laugh' | 'wave' | 'idle';
export type Reply = { you: string; daisy: string; mood?: Mood };
export type Exchange = { daisy: string; replies: Reply[] };
export type CartTalk = { visit: number; diff: number; last: Drink | null };

const OPENERS: Exchange[] = [
  {
    daisy: "Afternoon. You must be the new member Reginald told me to keep an eye on.",
    replies: [
      { you: 'What did he say about me?', daisy: "That you swing hard and tip harder. I'm hoping at least one of those is true.", mood: 'laugh' },
      { you: 'Only one eye?', daisy: "Two, if you behave. Reginald has the other pair, and he doesn't blink." },
      { you: "I'm harmless. Promise.", daisy: 'The last member who said that drove a cart into the koi pond. The koi are still upset.', mood: 'laugh' },
    ],
  },
  {
    daisy: 'Back so soon? Either you missed me, or that last hole went badly.',
    replies: [
      { you: 'Bit of both.', daisy: "Honest. I like that. Most of them blame the greenskeeper.", mood: 'laugh' },
      { you: 'I missed you, obviously.', daisy: "Smooth. Reginald warned me about the smooth ones. Says it always ends with a bar tab." },
      { you: 'The hole went fine, thanks.', daisy: 'Mm-hm. The scorecard and I will discuss that later.' },
    ],
  },
];

function aboutRound(diff: number): Exchange {
  if (diff < 0)
    return {
      daisy: "Word on the cart radio is you're under par. Should I be asking for an autograph?",
      replies: [
        { you: "Pen's in the bag.", daisy: "Easy, Arnie. Finish the round, then we'll talk autographs.", mood: 'laugh' },
        { you: 'Just lucky.', daisy: "Luck's a skill out here. So is knowing when to stop talking about it." },
      ],
    };
  if (diff === 0)
    return {
      daisy: 'Level par so far. Very respectable. Very... beige.',
      replies: [
        { you: 'Beige wins tournaments.', daisy: "So does a hot putter. I can't help with the putter, but I can help with the nerves." },
        { you: "I'm saving the fireworks.", daisy: "Don't save them too long. This course eats fireworks for breakfast.", mood: 'laugh' },
      ],
    };
  if (diff <= 2)
    return {
      daisy: 'I watched that last one from the cart path. Bold strategy.',
      replies: [
        { you: 'I meant to do that.', daisy: 'Sure you did. So did the squirrel you nearly took out.', mood: 'laugh' },
        { you: "Don't tell anyone.", daisy: "Your secret's safe with me. The cart radio, less so." },
      ],
    };
  return {
    daisy: "Rough day? You've got that look. The 'I used to be good at this' look.",
    replies: [
      { you: 'I WAS good at this.', daisy: "I believe you. Reginald doesn't, but I do.", mood: 'laugh' },
      { you: 'Is it that obvious?', daisy: 'Only from the cart. And the clubhouse. And possibly from space.' },
    ],
  };
}

export function script(t: CartTalk): Exchange[] {
  return [OPENERS[Math.min(t.visit, OPENERS.length) - 1], aboutRound(t.diff)];
}

export function orderLine(t: CartTalk) {
  if (t.last) return 'Same again, or are we feeling adventurous?';
  return t.visit > 1 ? 'Right. What are we drinking?' : "Right then. What'll it be?";
}

export function orderReply(choice: Drink | null, t: CartTalk) {
  if (choice && choice === t.last) return "The usual. I'm already pouring.";
  if (choice === 'palmer') return 'Arnold Palmer. Half lemonade, half iced tea, all steady hands. Good choice.';
  if (choice === 'lager') return 'A lager before the tee shot. Living dangerously. I respect it.';
  if (choice === 'water') return "Sparkling water. Reginald will be thrilled. I'm mildly disappointed.";
  return t.visit > 1 ? "Playing it straight? Fine. I'll save you one for the nineteenth." : "Your loss. I'll be around if you change your mind.";
}
