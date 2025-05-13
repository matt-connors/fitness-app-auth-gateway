import type { Context } from 'hono'
import type { VerifyFirebaseAuthEnv } from '@hono/firebase-auth'

// The hono "c" environment variable
export type HonoContext = Context<{ Bindings: VerifyFirebaseAuthEnv & Env & { firebaseTokenJson?: any } }>;