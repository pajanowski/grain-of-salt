import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { DEMO_USER_ID } from '$lib/server/db/schema';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Returns true if single-user local development mode is active.
 * Controlled via SINGLE_USER_MODE or PUBLIC_SINGLE_USER_MODE env vars.
 */
export function isSingleUserMode(): boolean {
	const val = privateEnv.SINGLE_USER_MODE ?? publicEnv.PUBLIC_SINGLE_USER_MODE;
	return val === 'true' || val === '1';
}

export const DEV_USER: User = {
	id: DEMO_USER_ID,
	app_metadata: { provider: 'email', providers: ['email'] },
	user_metadata: { display_name: 'Demo User' },
	aud: 'authenticated',
	confirmation_sent_at: '',
	recovery_sent_at: '',
	email_change_sent_at: '',
	new_email: '',
	invited_at: '',
	action_link: '',
	email: 'demo@grain-of-salt.local',
	phone: '',
	created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
	confirmed_at: new Date('2026-01-01T00:00:00Z').toISOString(),
	email_confirmed_at: new Date('2026-01-01T00:00:00Z').toISOString(),
	phone_confirmed_at: '',
	last_sign_in_at: new Date().toISOString(),
	role: 'authenticated',
	updated_at: new Date().toISOString(),
	identities: [],
	is_anonymous: false,
	factors: []
};

export const DEV_SESSION: Session = {
	access_token: 'dev-access-token',
	token_type: 'bearer',
	expires_in: 3600 * 24 * 365,
	expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
	refresh_token: 'dev-refresh-token',
	user: DEV_USER
};
