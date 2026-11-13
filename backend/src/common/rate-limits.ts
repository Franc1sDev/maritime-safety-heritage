import { Throttle } from '@nestjs/throttler';
import { config } from '../config/config';

const MIN = 60_000, HOUR = 3_600_000;
const t = (limit: number, ttl: number) => Throttle({ default: { limit: limit * config.rateLimitScale, ttl } });

export const DEFAULT_LIMIT = { name: 'default', limit: 120, ttl: MIN };
/** Sign-in attempts per IP address. Accounts also lock after repeated failures. */
export const LoginLimit = () => t(10, MIN);
export const RegisterLimit = () => t(5, HOUR);
export const ResetLimit = () => t(5, HOUR);
export const ContactLimit = () => t(5, HOUR);
export const UploadLimit = () => t(30, HOUR);
