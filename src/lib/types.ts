export type Role = 'tentor' | 'mentee';

export type QuestionStatus = 'menunggu' | 'berjalan' | 'selesai' | 'hangus';
export type AssignmentStatus = 'menunggu' | 'diterima' | 'ditolak' | 'terlambat';
export type MessageType = 'teks' | 'foto' | 'suara';

export interface Profile {
  id: string;
  role: Role;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  group_name: 'IPA' | 'IPS' | 'Wajib';
  sort_order: number;
}

export interface TentorProfile {
  profile_id: string;
  kelas: string;
  rating: number;
  rating_count: number;
  total_answered: number;
  is_available: boolean;
  is_teaching: boolean;
  access_code_verified: boolean;
}

export interface TentorCandidate {
  tentorId: string;
  rating: number;
  totalAnswered: number;
  answeredToday: number;
  tier: number; // 1..5, dihitung dari rating
}

export interface QuestionRow {
  id: string;
  mentee_id: string;
  subject_id: string;
  content: string;
  photo_url: string | null;
  status: QuestionStatus;
  accepted_tentor_id: string | null;
  accepted_at: string | null;
  ended_at: string | null;
  rating_given: number | null;
  auto_closed: boolean;
  last_broadcast_at: string;
  broadcast_round: number;
  expires_at: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  question_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  created_at: string;
}
