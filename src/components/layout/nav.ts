// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
import { BarChart3, CalendarDays, House, Lightbulb, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  from: string;
  toColor: string;
  shortcut: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: House, from: '#ff8a4c', toColor: '#ff4d6d', shortcut: '1' },
  {
    to: '/ideas',
    label: 'الأفكار',
    icon: Lightbulb,
    from: '#a78bfa',
    toColor: '#7c3aed',
    shortcut: '2',
  },
  {
    to: '/calendar',
    label: 'التقويم',
    icon: CalendarDays,
    from: '#38bdf8',
    toColor: '#4f46e5',
    shortcut: '3',
  },
  {
    to: '/stats',
    label: 'الأرقام',
    icon: BarChart3,
    from: '#34d399',
    toColor: '#0d9488',
    shortcut: '4',
  },
];
