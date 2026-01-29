
import { AppPhase } from './types';

/**
 * Single centralized date engine for Cloud Tracker
 * Handles BST (UTC+6) and Phase Flow Logic
 */

export const getBSTDate = (): Date => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 6));
};

export const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getAppPhase = (): { phase: AppPhase; daysRemaining?: number; ramadanDay?: number } => {
  const now = getBSTDate();
  const year = now.getFullYear();
  
  // 2025 Milestones (Simplified for demo, but logically robust)
  const shabEBarat = new Date(year, 1, 4); // Feb 4
  const ramadanStart = new Date(year, 1, 18); // Feb 18
  const ramadanEnd = new Date(year, 2, 20); // Mar 20 (Approx 30 days)
  const eidDay = new Date(year, 2, 21); // Mar 21
  const asStart = new Date(year, 3, 28); // Apr 28
  const asEnd = new Date(year, 5, 4); // Jun 4
  const holidayEnd = new Date(year, 5, 29); // Jun 29
  const a2Start = new Date(year, 5, 30); // Jun 30
  const resultsDay = new Date(year, 7, 19); // Aug 19

  if (now < ramadanStart) {
    const diff = Math.ceil((ramadanStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { phase: 'Pre-Ramadan', daysRemaining: diff };
  }
  
  if (now >= ramadanStart && now <= ramadanEnd) {
    const day = Math.floor((now.getTime() - ramadanStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { phase: 'Ramadan', ramadanDay: day };
  }

  if (formatDateISO(now) === formatDateISO(eidDay)) {
    return { phase: 'Eid' };
  }

  if (now > eidDay && now < asStart) {
    const diff = Math.ceil((asStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { phase: 'AS-Countdown', daysRemaining: diff };
  }

  if (now >= asStart && now <= asEnd) {
    return { phase: 'AS-Ongoing' };
  }

  if (now > asEnd && now <= holidayEnd) {
    return { phase: 'Holidays' };
  }

  if (now >= a2Start) {
    return { phase: 'A2-Ongoing' };
  }

  return { phase: 'A2-Ongoing' }; // Fallback
};

export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
