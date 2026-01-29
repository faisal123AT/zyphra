
export type TimeOfDay = 'Morning' | 'Day' | 'Evening' | 'Night';

export interface CloudData {
  id: string;
  type: 'tracker' | 'project' | 'decorative' | 'easteregg';
  title?: string;
  content?: string;
  initialX: number;
  initialY: number;
  scale?: number;
  color?: string;
}

export type Category = 'Studying' | 'Classes' | 'Paper Checking' | 'Sleep' | 'Workout' | 'Prayers' | 'Other';

export interface ActivityLog {
  id: string;
  uid: string;
  date: string; // ISO string
  category: Category;
  duration: number; // decimal hours
  journal: string;
  timestamp: number;
}

export interface Task {
  id: string;
  uid: string;
  date: string; // Date this task is for
  text: string;
  completed: boolean;
  category?: Category;
}

export interface User {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: number;
}

export interface PastPaperEntry {
  id: string; // subject-subtopic-year-session-paper
  uid: string;
  subject: string;
  subtopic: string;
  year: number;
  session: string;
  paper: string;
  completed: boolean;
  marks: string;
}

export interface RamadanEntry {
  uid: string;
  date: string;
  prayers: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
    taraweeh: boolean;
    tahajjud: boolean;
  };
  fasting: {
    suhoor: boolean;
    iftar: boolean;
  };
}

export type AppPhase = 
  | 'Pre-Ramadan' 
  | 'Ramadan' 
  | 'Eid' 
  | 'AS-Countdown' 
  | 'AS-Ongoing' 
  | 'Holidays' 
  | 'A2-Ongoing';
