import { Hono } from 'hono'
import { csrf } from 'hono/csrf';
import {
    VerifyFirebaseAuthEnv,
} from '@hono/firebase-auth'
import { handleLogin, handleLoginSession, handleLogout, handleSignup, handleVerifySession } from '@/src/auth';
import { addFirebaseTokenMiddleware, protectAppicableroutesMiddleware } from '@/src/utils/routing';
import { handleGraphql } from '@/src/services/graphql';

const app = new Hono<{ Bindings: VerifyFirebaseAuthEnv & Env }>();

// Protect all routes with CSRF
app.use('*', csrf());

// Expose route for direct login with username/password
app.post('/login', handleLogin);

// Expose route to handle new session login
app.post('/login_session', handleLoginSession);

// Expose route to handle logout
app.post('/logout', handleLogout);

// Expose route to handle signup
app.post('/signup', handleSignup);

// Expose route to handle session verification
app.get('/verify-session', handleVerifySession);

// Protect the route if it's not in the unprotectedRoutes list
app.use("*", protectAppicableroutesMiddleware);

// Add the firebase token to the context
app.use('*', addFirebaseTokenMiddleware);

console.log('test!')

/**
 * Routes
 */

// Graphql API
app.get('/graphql', handleGraphql);

// If no other routes match, return a 404
app.notFound(c => {
    return c.text('Resource not found', 404)
})

// Expose the app for cloudflare
export default app;