import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// The first-use hints have their own test; keep them out of the way of the others.
beforeEach(() => { localStorage.setItem('guide', '1'); });
