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
  wins: number; // months won
  feats: string[];
  joined: string; // ISO date, for the member number
  career?: { rounds: number; best: number | null; avg: number | null }; // every round they've played, to par
};

// Where a tee shot came to rest, in course feet. Null if it found the water or went out.
export type Spot = { x: number; y: number } | null;

// One finished round: all holes of the month's course in one go.
export type Round = {
  playerId: string;
  month: string; // YYYY-MM, Eastern time
  course: string;
  holes: number[];
  total: number;
  par: number;
  feats: string[];
  spots?: Spot[] | null; // one per hole
  createdAt: string;
};

export type Champion = { month: string; playerIds: string[]; total: number; par: number };

export type Snapshot = {
  today: string;
  month: string;
  groupName: string;
  me: string;
  admin?: boolean; // runs the club: the only one who can put up new members
  players: Player[];
  rounds: Round[]; // this month, whole group
  champions: Champion[]; // past months, newest first
};

// A personal, single-use invitation. The link (#/invite/<id>) shows the code under the foil.
export type Invite = { id: string; name: string; code: string; createdAt: string; usedBy: string | null; usedAt: string | null };
// A note to the Committee. Only the admin reads them.
export type Feedback = { id: number; from: string | null; body: string; context: string | null; done: boolean; createdAt: string };
// Club news from the admin, signed as Reginald or as themselves.
export type Notice = { id: number; body: string; asReginald: boolean; author: string | null; createdAt: string };
// Practice on the range, the short game area, or a practice round of the next course. Never on the board.
export type PracticeKind = 'caldera' | 'range' | 'shortgame';
export type PracticeReport = {
  kinds: { kind: PracticeKind; sessions: number; members: number; minutes: number }[];
  members: { name: string; caldera: number; range: number; shortgame: number; lastAt: string }[];
  recent: { name: string; kind: PracticeKind; startedAt: string; endedAt: string | null; shots: number }[];
};
// Member activity this month, for the admin only. Counts, never a trail.
export type ActivityKind = 'visit' | 'locker';
export type MemberActivity = { name: string; lastSeen: string | null; days: number; rounds: number; practice: number; lockers: number };
export type InvitePeek = { name: string; code: string; groupName: string; used: boolean };

export interface Api {
  mode: 'local' | 'supabase';
  join(invite: string, name: string, pin: string): Promise<Session>;
  signIn(name: string, pin: string): Promise<Session>; // returning members: no code needed
  myClubs(name: string, pin: string): Promise<Session[]>; // every club that name and PIN belong to
  createClub(session: Session, name: string): Promise<Session>; // the admin starts another club
  snapshot(session: Session): Promise<Snapshot>;
  submitRound(session: Session, r: { course: string; holes: number[]; pars: number[]; feats: string[]; spots?: Spot[] }): Promise<void>;
  saveAvatar(session: Session, avatar: Avatar): Promise<void>;
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
  startPractice(session: Session, kind: PracticeKind): Promise<number>;
  endPractice(session: Session, id: number, shots: number): Promise<void>;
  practiceReport(session: Session): Promise<PracticeReport>;
  touch(session: Session, kind: ActivityKind): Promise<void>;
  activityReport(session: Session): Promise<MemberActivity[]>;
}
