import { track } from '@vercel/analytics';

export const logEvent = (event: string, details: Record<string, any> = {}): void => {
  track(event, details);
};
