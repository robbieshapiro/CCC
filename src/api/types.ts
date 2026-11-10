import type { Bonus } from '../bonus';
export const MAX_OVER_PAR = 3; // pick up at par + 3

import type { GolferSpec } from '../golf3d/golfer';

export type Avatar = {
  color: string;
  equip: Partial<Record<string, string>>;
  skin?: string;
  hair?: string;
  hairColor?: string;
  golfer?: GolferSpec; // the 3D golfer; older 2D fields above are kept for old rows
  onboarded?: boolean; // has been through the welcome
};

export type Session = {
  token: string;
  playerId: string;
  groupId: string;
  groupName: string;
};

export type Player = {
  id: string;
  name: string;
  avatar: Avatar;
  host?: boolean; // runs this club without playing in it: never on its board
  wins: number; // titles won: periods topped (see src/day.ts)
  feats: string[];
  joined: string; // ISO date, for the member number
  career?: { rounds: number; best: number | null; avg: number | null }; // every round they've played, to par
  earnings?: number; // the money list: play money won from the weekly purses (src/purse.ts)
  top10s?: number;
  spent?: number; // what they've spent in the Pro Shop (src/shop.ts): their balance is earnings less this
  owned?: string[]; // the Pro Shop items they own (earnings, spent and owned follow the person across their clubs)
  bonus?: Bonus; // the side money (src/bonus.ts): rounds, streaks, Closest to the Pin, birdies and better
  away?: boolean; // playing here from another club: on the board and in for the title, but their home club pays them
  committee?: boolean; // runs the clubs: shown as the Committee, never tagged a guest (display only)
};

// Where a tee shot came to rest, in course feet. Null if it found the water or went out.
export type Spot = { x: number; y: number } | null;

// One finished round: all holes of the period's course in one go.
export type Round = {
  playerId: string;
  month: string; // the game period, Eastern time: YYYY-MM for months, then the week's Monday YYYY-MM-DD (src/day.ts)
  course: string;
  holes: number[];
  total: number;
  par: number;
  feats: string[];
  spots?: Spot[] | null; // one per hole
  createdAt: string;
};

// how: 'won' outright, 'shared' (a tie nobody played off), 'playoff' (tied, and the playoff is today) or 'playoff-won'
export type Champion = { month: string; playerIds: string[]; total: number; par: number; how?: 'won' | 'shared' | 'playoff' | 'playoff-won' };
// The playoff being played at your club today, when a week closed with a tie for the title (see playoff_state)
export type PlayoffState = {
  period: string;
  mine: boolean;
  players: { id: string; name: string; started: boolean; strokes: number | null; shot: boolean; ft: number | null; holed: boolean; lost: boolean }[];
};

export type Snapshot = {
  today: string;
  month: string;
  groupName: string;
  me: string;
  admin?: boolean; // runs the club: the only one who can put up new members
  homeGroupId?: string; // the club your play counts for (differs when you only run this one)
  homeName?: string;
  players: Player[];
  rounds: Round[]; // this period, whole group
  champions: Champion[]; // past periods, newest first
  crown?: DailyCrown | null; // filled in by state.refresh alongside the snapshot
  payouts?: Payout[]; // what the last closed period's purse paid, best first
};
// name and mine: from Nov 8 the payouts are the whole Open's, most of them from other clubs
export type Payout = { month: string; playerId: string; place: number; tied: boolean; payout: number; name?: string; mine?: boolean };

// Yesterday's Closest to the Pin winner across every club. ids: their member ids in your club, if they're in it.
export type DailyCrown = { day: string; name: string; club: string; ft: number | null; holed: boolean; ids: string[] };
// The honours for a closed period at your club (see period_honors in supabase/schema.sql). Ties share.
export type Named = { names: string[]; count?: number; avg?: number; toPar?: number };
export type Honors = {
  period: string;
  champions: { name: string; toPar: number; how?: Champion['how'] }[];
  runnersUp: { name: string; toPar: number }[];
  mostRounds: Named | null;
  aces: { name: string; count: number }[];
  lowestAverage: Named | null; // five rounds or more
  highestScore: Named | null;
};

// A personal, single-use invitation. The link (#/invite/<id>) shows the code under the foil.
export type Invite = { id: string; name: string; code: string; createdAt: string; usedBy: string | null; usedAt: string | null };
// A note to the Committee. Only the admin reads them.
export type Feedback = { id: number; from: string | null; body: string; context: string | null; done: boolean; createdAt: string };
// Club news from the admin, signed as Reginald or as themselves.
// a kudos or a chirp from another member, waiting on your home page
export type ShoutKind = 'kudos' | 'chirp';
export type Shoutout = { id: number; kind: ShoutKind; body: string; from: string; fromAvatar?: Avatar; createdAt: string };
export type AdminShoutout = { id: number; kind: ShoutKind; body: string; from: string; to: string; seen: boolean; removed: boolean; createdAt: string };
export type Notice = { id: number; body: string; asReginald: boolean; author: string | null; createdAt: string };
// Practice on the range, the short game area, or a practice round of the next course. Never on the board.
// 'caldera' is a practice round on the next course's preview holes (the name is from the first one); 'course' is a
// practice round of the week's own course, once daily cards start
export type PracticeKind = 'caldera' | 'range' | 'shortgame' | 'course';
export type PracticeReport = {
  kinds: { kind: PracticeKind; sessions: number; members: number; minutes: number }[];
  members: { name: string; caldera: number; range: number; shortgame: number; course?: number; lastAt: string }[];
  recent: { name: string; kind: PracticeKind; startedAt: string; endedAt: string | null; shots: number }[];
};
// Member activity this month, for the admin only. Counts, never a trail.
export type ActivityKind = 'visit' | 'locker';
export type MemberActivity = { name: string; lastSeen: string | null; days: number; rounds: number; practice: number; lockers: number };
// The Open: this month's best round per person across every club. One entry a person, under their first club.
// localId: their member id in the viewer's club, if they're in it.
export type OpenRow = { playerId: string; name: string; club: string; mine: boolean; localId: string | null; avatar: Avatar; holes: number[]; total: number; par: number; rounds: number; last: string; createdAt: string };
// Today's field on a course, every club (course_field): a card in, or the holes so far of one in progress
// playerId: the person as the Open names them; mine: you; at: when the card went in, or was started
export type FieldRow = { playerId: string; name: string; club: string; avatar: Avatar; holes: number[]; spots: ({ x: number; y: number } | null)[]; going: boolean; at: string; mine: boolean; localId: string | null };
// A course's record over every round ever played on it, every club (course_records): free play on a classic course counts
export type CourseRecord = { course: string; toPar: number; holders: { name: string; club: string }[] | null; mine: number | null; rounds: number; champions: { name: string; club: string; toPar: number }[] };
// Season points, FedEx Cup style (season_standings): banked from closed weeks, projected from this week's place
export type SeasonRow = { playerId: string; name: string; club: string; mine: boolean; points: number; projected: number; events: number; wins: number; top10s: number; best: number | null; earnings: number };
// One golfer's card from any club (golfer_card): their Open weeks this season, career and money across their seats
export type GolferWeek = { week: string; course: string; place: number; tied: boolean; field: number; toPar: number; holes: number[]; total: number; par: number; points: number; banked: boolean };
export type GolferCard = { playerId: string; name: string; avatar: Avatar; club: string; clubs: string[] | null; joined: string; mine: boolean; earnings: number; top10s: number; titles: number; career: { rounds: number; best: number | null; avg: number | null }; feats: string[]; weeks: GolferWeek[] };
export type Season = { year: number; standings: SeasonRow[] };
// One person's Trophy Room progress (trophy_progress): counts from what's recorded; the plaques are in src/trophies.ts
export type TrophyProgress = {
  playerId: string; name: string; birdies: number; eagles: number; albatross: number; aces: number; cards: number; underpar: number; bogeyfree: number;
  putts30: number; putts60: number; chipins: number; pinseeker: number; longdrive: number; streak: number; ctpwins: number; designplayers: number;
  titles: number; openwins: number; opentop10: number; secrets: string[]; birdieHoles: Record<string, number[]>;
};
export type OpenChampion = { month: string; names: string[]; total: number; par: number };
// The admin tab: every club the admin runs, on one page.
export type AdminWindow = 'week' | 'month' | 'all';
// Weekly Players by day: members who posted a round in the 7 days to that day, out of the members there were then
export type TrendDay = { day: string; players: number; members: number };
// The Committee Room's headline numbers (admin_kpis in supabase/schema.sql)
export type AdminKpis = {
  period: string;
  prevPeriod: string | null;
  today: string;
  members: number;
  visitedToday: number;
  playedToday: number;
  visitedWeekAgo: number;
  playedWeekAgo: number;
  lastPlayers: number; // played last period
  cameBack: number; // ...and have played this one
  rounds: number;
  players: number;
  prevRounds: number;
  prevPlayers: number;
  joined14: number;
  firstRound14: number;
  neverPlayed14: string[];
  purse: number;
  shop7: number;
  shopAll: number;
  ai: { today: Record<string, number>; designsToday: number; month: number };
  days: { day: string; played: number; visited: number }[];
  weeks: { period: string; players: number; rounds: number; back: number; before: number }[];
  holes: { hole: number; par: number; n: number; avg: number; eagle: number; birdie: number; pars: number; bogey: number; worse: number }[];
};
// Reginald's morning read of the numbers, for the Committee
export type AdminInsights = { day: string; points: string[] };
export type AdminOverview = {
  // members: whose home club it is; guests: members of another club with a seat here
  clubs: { id: string; name: string; members: number; guests?: number; active: number; rounds: number; practice: number; newMembers: number }[];
  // across all the clubs, each person once (a guest in two clubs is one member)
  totals?: { members: number; active: number; rounds: number; practice: number; newMembers: number };
  // one row a person, under their home club; guestAt: the other clubs they play in as a guest
  members: { club: string; guestAt?: string[]; name: string; joined: string; lastSeen: string | null; days: number; rounds: number; unfinished: number; best: number | null; practice: number; lockers: number }[];
  feed: { at: string; kind: 'round' | 'quit' | 'practice' | 'join' | 'feedback'; club: string; name: string; course: string | null; total: number | null; par: number | null; what: string | null; shots: number | null }[];
  feedback: { id: number; club: string; from: string | null; body: string; context: string | null; createdAt: string }[];
  invites: { id: string; club: string; name: string; code: string; createdAt: string }[];
};
// The Daily Shot: one shot a day for everyone, three tries, best counts (see daily.ts)
// The Committee Room's Today (admin_today): everyone in today, each person once, and today's feed
export type AdminTodayPerson = { name: string; club: string; last: string | null; card: 'in' | 'going' | null; toPar: number | null; total: number | null; hole: number | null; practice: number; daily: boolean; dailyFt: number | null };
export type AdminTodayEvent = { at: string; kind: 'round' | 'start' | 'practice' | 'daily' | 'playoff' | 'join' | 'feedback'; name: string; club: string; what: string | null; total: number | null; par: number | null; n: number | null; ft: number | null };
export type AdminToday = { today: string; in: number; cardsIn: number; onCourse: number; people: AdminTodayPerson[]; feed: AdminTodayEvent[] };
export type DailyTry = { try: number; ft: number | null; holed: boolean; lost: boolean };
export type DailyRow = { name: string; club: string; ft: number | null; holed: boolean; holedTry?: number | null; tries: number; mine: boolean };
export type DailyState = { mine: DailyTry[]; board: DailyRow[]; players: number; streak: number };
export type DailyDay = { day: string; players: number; tries: number };
// The Nineteenth Hole's weekly contests (see bar.ts): best score of the week, higher is better
export type BarBoard = { week: string; board: { name: string; score: number; mine: boolean }[]; mine: number | null; players: number };
export type ClubRow = { id: string; name: string; mine: boolean; members: number; played: number; best: number | null; leaders: string[] | null };
export type Chronicle = { week: string; body: { headline: string; dek: string; items: { title: string; body: string }[]; signoff: string } };
export type DesignStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
// a member's golf hole from the Design Desk (spec: src/designer/hole.ts HoleSpec)
export type Design = { id: number; prompt: string; spec: import('../designer/hole').HoleSpec; par: number | null; status: DesignStatus; createdAt: string; by?: string; club?: string };
export type MembersHole = { id: number; spec: import('../designer/hole').HoleSpec; par: number; by: string };
// One counted stroke of a round (h: the hole's index); see ShotLog in golf3d/engine.ts
export type RoundShot = { h: number; c: string; p: number; e: number; f: [number, number]; t: [number, number]; l: string; x: 0 | 1; i: 0 | 1 };
// The Committee's hole report for this week's course (admin_holes): how each hole is really being played
export type HoleReport = {
  hole: number;
  rounds: number; // rounds with shot data
  putts: number; // per hole, on average
  threePutts: number; // share of holes with three putts or more
  penalties: number; // per hole, on average
  teeClubs: Record<string, number>;
  lies: Record<string, number>; // where shots were hit from
  tee: [number, number][]; // where tee shots finished
  wet: [number, number][]; // where shots cost a penalty
};
// Today's card: whether it's in, and where one in progress stands (holes done, strokes on the hole being played)
export type CardProgress = { scores: number[]; shots: number; spots: (Spot | null)[]; feats: string[] };
// club/clubId: set when today's card is in, or going, at another of the member's clubs (one card a day per person)
export type CardToday = CardProgress & { done: boolean; id: number | null; course: string | null; club?: string | null; clubId?: string | null };
export type InvitePeek = { name: string; code: string; groupName: string; used: boolean };

export interface Api {
  mode: 'local' | 'supabase';
  join(invite: string, name: string, pin: string): Promise<Session>;
  myClubs(name: string, pin: string): Promise<Session[]>; // returning members: every club that name and PIN belong to
  createClub(session: Session, name: string): Promise<Session>; // the admin starts another club
  snapshot(session: Session): Promise<Snapshot>;
  submitRound(session: Session, r: { course: string; holes: number[]; pars: number[]; feats: string[]; spots?: Spot[]; card?: boolean; shots?: RoundShot[] }): Promise<void>;
  adminHoles(session: Session): Promise<HoleReport[]>;
  // a member finished a hole on the Members' Course: true when it paid its designer (once per member per hole a week)
  recordDesignPlay(session: Session, design: number): Promise<boolean>;
  saveAvatar(session: Session, avatar: Avatar): Promise<void>;
  buyItem(session: Session, item: string): Promise<void>; // the Pro Shop: checks rank and balance, then it's yours
  createInvite(session: Session, name: string): Promise<{ id: string; name: string; code: string }>;
  listInvites(session: Session): Promise<Invite[]>;
  deleteInvite(session: Session, id: string): Promise<void>;
  peekInvite(id: string): Promise<InvitePeek | null>;
  submitFeedback(session: Session, body: string, context: string): Promise<void>;
  listFeedback(session: Session): Promise<Feedback[]>;
  setFeedbackDone(session: Session, id: number, done: boolean): Promise<void>;
  postNotice(session: Session, body: string, asReginald: boolean): Promise<void>;
  listNotices(session: Session): Promise<Notice[]>;
  takeDownNotice(session: Session, id: number): Promise<void>;
  // kudos and chirps between members of a club (send_shoutout and friends in schema.sql)
  sendShoutout(session: Session, to: string, kind: ShoutKind, body: string): Promise<void>;
  myShoutouts(session: Session): Promise<Shoutout[]>;
  seenShoutouts(session: Session, ids: number[]): Promise<void>;
  adminShoutouts(session: Session): Promise<AdminShoutout[]>;
  removeShoutout(session: Session, id: number): Promise<void>;
  startPractice(session: Session, kind: PracticeKind): Promise<number>;
  endPractice(session: Session, id: number, shots: number): Promise<void>;
  practiceReport(session: Session): Promise<PracticeReport>;
  touch(session: Session, kind: ActivityKind): Promise<void>;
  activityReport(session: Session): Promise<MemberActivity[]>;
  adminOverview(session: Session, window: AdminWindow): Promise<AdminOverview>;
  adminFeedbackDone(session: Session, id: number, done: boolean): Promise<void>;
  dailyState(session: Session, day: string): Promise<DailyState>;
  submitDaily(session: Session, day: string, t: DailyTry): Promise<void>;
  dailyAdmin(session: Session): Promise<DailyDay[]>;
  submitBar(session: Session, game: 'minigolf' | 'drive' | 'members', score: number): Promise<void>;
  barBoard(session: Session, game: 'minigolf' | 'drive' | 'members'): Promise<BarBoard>; // the last 7 days across the admin's clubs
  openBoard(session: Session): Promise<OpenRow[]>;
  clubList(session: Session): Promise<ClubRow[]>;
  chronicles(session: Session): Promise<Chronicle[]>;
  myDesigns(session: Session): Promise<Design[]>;
  submitDesign(session: Session, id: number, par: number): Promise<void>;
  designQueue(session: Session): Promise<Design[]>; // the admin's: waiting, and on the course
  reviewDesign(session: Session, id: number, ok: boolean): Promise<void>;
  membersCourse(session: Session): Promise<MembersHole[]>; // Reginald's weekly letters to your club, newest first // every club this month: members, leader, best
  openChampions(session: Session): Promise<OpenChampion[]>;
  dailyCrown(session: Session): Promise<DailyCrown | null>;
  // the Committee's picks for the weeks ahead (and gone by): period -> course id (course_schedule)
  courseSchedule(session: Session): Promise<Record<string, string>>;
  // the admin picks a future week's course; null puts it back on the calendar
  setCourseSchedule(session: Session, period: string, course: string | null): Promise<void>;
  periodHonors(session: Session, period: string): Promise<Honors>;
  adminTrend(session: Session): Promise<TrendDay[]>;
  adminToday(session: Session): Promise<AdminToday>;
  courseField(session: Session, course: string): Promise<FieldRow[]>;
  // who practised the week's course today, every club, each person once, newest first
  coursePractice(session: Session): Promise<{ playerId: string; name: string; club: string; mine: boolean }[]>;
  courseRecords(session: Session): Promise<CourseRecord[]>;
  seasonStandings(session: Session): Promise<Season>;
  trophyProgress(session: Session, playerId?: string): Promise<TrophyProgress | null>;
  golferCard(session: Session, playerId: string): Promise<GolferCard | null>;
  submitFreeRound(session: Session, course: string, holes: number[], pars: number[]): Promise<void>; // a classic course: never counts // today's golfers on the course, every club
  adminKpis(session: Session): Promise<AdminKpis>;
  // a counted round's start, how far it got, and whether it finished
  // card: today's card (the same one all day, so a card cut short picks up where it left off)
  startRound(session: Session, course: string, card?: boolean): Promise<number | null>;
  roundProgress(session: Session, id: number, hole: number, finished: boolean): Promise<void>;
  // daily cards (from Nov 8): null before they start
  cardToday(session: Session): Promise<CardToday | null>;
  cardProgress(session: Session, id: number, c: CardProgress): Promise<void>;
  // the playoff: one hole, once, then one shot at the pin
  playoffState(session: Session): Promise<PlayoffState | null>;
  playoffStart(session: Session): Promise<void>;
  playoffFinish(session: Session, strokes: number): Promise<void>;
  playoffShot(session: Session, shot: { ft: number | null; holed: boolean; lost: boolean }): Promise<void>;
}
