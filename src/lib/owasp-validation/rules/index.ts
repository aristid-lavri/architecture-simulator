import { OwaspAuth001 } from './OwaspAuth001';
import { OwaspAuth002 } from './OwaspAuth002';
import { OwaspNet001 } from './OwaspNet001';
import { OwaspNet002 } from './OwaspNet002';
import { OwaspNet003 } from './OwaspNet003';
import { OwaspRate001 } from './OwaspRate001';
import { OwaspRes001 } from './OwaspRes001';
import { OwaspRes002 } from './OwaspRes002';
import { OwaspDlq001 } from './OwaspDlq001';
import { OwaspDos001 } from './OwaspDos001';
import type { OwaspRule } from '../types';

export const ALL_RULES: ReadonlyArray<OwaspRule> = [
  OwaspAuth001, OwaspAuth002,
  OwaspNet001, OwaspNet002, OwaspNet003,
  OwaspRate001,
  OwaspRes001, OwaspRes002,
  OwaspDlq001,
  OwaspDos001,
];
