import { Throttle } from '@nestjs/throttler';
import { config } from '../config/config';

const MIN = 60_000, HOUR = 3_600_000;
const t = (limit: number, ttl: number) => Throttle({ default: { limit: limit * config.rateLimitScale, ttl } });

/** Rate limits on sign-in, posting, commenting, messaging and reporting (Section 4.7). Public reads use the default. */
export const DEFAULT_LIMIT = { name: 'default', limit: 180, ttl: MIN };
/** Sign-in attempts per IP address. Admin accounts also lock after repeated failures. */
export const LoginLimit = () => t(10, MIN);
export const RegisterLimit = () => t(5, HOUR);
export const ResetLimit = () => t(5, HOUR);
export const UploadLimit = () => t(120, HOUR);
export const PostLimit = () => t(20, HOUR);
export const CommentLimit = () => t(30, MIN);
export const MessageLimit = () => t(40, MIN);
export const ReportLimit = () => t(15, HOUR);
/** Forms open to visitors (safety concerns, feedback). */
export const PublicFormLimit = () => t(5, HOUR);
/** Page-speed reports from the website: one small batch per page visited. */
export const RumLimit = () => t(120, HOUR);
