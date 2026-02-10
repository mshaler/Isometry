/**
 * A/B Testing Context
 *
 * React context for A/B testing
 */

import { createContext } from 'react';
import type { ABTestContextValue } from './types';

export const ABTestContext = createContext<ABTestContextValue | undefined>(undefined);
