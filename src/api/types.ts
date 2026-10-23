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
};

// One finished round: all holes of the month's course in one go.
export type Round = {
  playerId: string;
  month: string; // YYYY-MM, Eastern time
  course: string;
  holes: number[];
  total: number;
  par: number;
  feats: string[];
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
export type InvitePeek = { name: string; code: string; groupName: string; used: boolean };

export interface Api {
  mode: 'local' | 'supabase';
  join(invite: string, name: string, pin: string): Promise<Session>;
  signIn(name: string, pin: string): Promise<Session>; // returning members: no code needed
  snapshot(session: Session): Promise<Snapshot>;
  submitRound(session: Session, r: { course: string; holes: number[]; pars: number[]; feats: string[] }): Promise<void>;
  saveAvatar(session: Session, avatar: Avatar): Promise<void>;
  createInvite(session: Session, name: string): Promise<{ id: string; name: string; code: string }>;
  listInvites(session: Session): Promise<Invite[]>;
  peekInvite(id: string): Promise<InvitePeek | null>;
}
