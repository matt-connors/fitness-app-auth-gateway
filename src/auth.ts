import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import {
    VerifySessionCookieFirebaseAuthConfig,
} from '@hono/firebase-auth'
import { AdminAuthApiClient, ServiceAccountCredential } from 'firebase-auth-cloudflare-workers';

import authConfig from '@/config/authConfig';
import { HonoContext } from '@/src/definitions';

/**
 * Firebase Auth Configuration needed when invoking verifySessionCookieFirebaseAuth
 */
export const firebaseAuthConfig: VerifySessionCookieFirebaseAuthConfig = {
    // specify your firebase project ID.
    projectId: authConfig.projectId,
    redirects: {
        signIn: authConfig.signInUri
    }
}

/**
 * Handle direct login with username and password
 */
export const handleLogin = async (c: HonoContext) => {
    console.log('handleLogin!!!', c);
    try {
        const json = await c.req.json();
        const { email, password } = json;

        // Validate input
        if (!email || !password) {
            return c.json({ message: 'email and password are required' }, 400);
        }

        // Create service account credential
        const serviceAccountCredential = new ServiceAccountCredential(c.env.SERVICE_ACCOUNT_JSON);

        // Initialize auth API client
        const auth = AdminAuthApiClient.getOrInitialize(
            c.env.PROJECT_ID,
            serviceAccountCredential
        );

        // Authenticate with Firebase using the REST API with service account
        const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await serviceAccountCredential.getAccessToken()}`
            },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true,
                targetProjectId: c.env.PROJECT_ID
            })
        });

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } };
            return c.json({ 
                message: 'login failed', 
                error: errorData.error?.message || 'invalid credentials' 
            }, 401);
        }
        
        const userData = await response.json() as { 
            idToken?: string;
            localId?: string;
            email?: string;
            displayName?: string;
        };

        if (!userData.idToken) {
            return c.json({ 
                message: 'login failed', 
                error: 'no id token returned' 
            }, 500);
        }

        // Create the session cookie using the ID token
        const sessionCookie = await auth.createSessionCookie(userData.idToken, authConfig.sessionExpirey, c.env);
        
        // Set the cookie
        setCookie(c, 'session', sessionCookie, {
            maxAge: authConfig.sessionExpirey,
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'Strict',
        });

        // Return user information
        return c.json({ 
            message: 'login successful',
            user: {
                uid: userData.localId,
                email: userData.email,
                displayName: userData.displayName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return c.json({ message: 'login error', error: String(error) }, 500);
    }
}

/**
 * Handle the login session
 */
export const handleLoginSession = async (c: HonoContext) => {

    console.log('handleLoginSession!!!', c);

    const json = await c.req.json();
    const idToken = json.idToken;

    if (!idToken || typeof idToken !== 'string') {
        return c.json({ message: 'invalid idToken' }, 400);
    }

    // Create the session cookie. This will also verify the ID token in the process.
    // The session cookie will have the same claims as the ID token.
    // To only allow session cookie setting on recent sign-in, auth_time in ID token
    // can be checked to ensure user was recently signed in before creating a session cookie.
    const serviceAccountCredential = new ServiceAccountCredential(c.env.SERVICE_ACCOUNT_JSON);

    const auth = AdminAuthApiClient.getOrInitialize(
        c.env.PROJECT_ID,
        serviceAccountCredential
    );

    return await auth.createSessionCookie(idToken, authConfig.sessionExpirey, c.env)
        .then(
            (sessionCookie) => {
                setCookie(c, 'session', sessionCookie, {
                    maxAge: authConfig.sessionExpirey,
                    httpOnly: true,
                    secure: true,
                    // Prevent MitM attacks
                    // domain: "", 
                    sameSite: 'Strict',
                });
                return c.json({ message: 'success' });
            }
        )
        .catch(
            (error) => {
                switch (error.errorInfo?.code) {

                    // If the auth token is invalid, return a 400 error.
                    case 'auth/invalid-id-token':
                        return c.json({ message: 'invalid idToken' }, 400);

                    // If the error is not an auth error, log it to the console.
                    default:
                        console.error(error);
                }
                return c.json({ message: 'error' }, 400);
            }
        )
}

/**
 * Handle user logout
 */
export const handleLogout = async (c: HonoContext) => {
    console.log('handleLogout!!!', c);
    // Clear the session cookie
    deleteCookie(c, 'session', {
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict'
    });
    
    return c.json({ message: 'logout successful' });
}

/**
 * Handle user signup
 */
export const handleSignup = async (c: HonoContext) => {
    console.log('handleSignup!!!', c);
    try {
        const json = await c.req.json();
        const { email, password, displayName } = json;

        // Validate input
        if (!email || !password) {
            return c.json({ message: 'email and password are required' }, 400);
        }

        // Create service account credential
        const serviceAccountCredential = new ServiceAccountCredential(c.env.SERVICE_ACCOUNT_JSON);

        // Initialize auth API client
        const auth = AdminAuthApiClient.getOrInitialize(
            c.env.PROJECT_ID,
            serviceAccountCredential
        );

        // Create the user account
        // Note: The AdminAuthApiClient doesn't directly expose a createUser method,
        // so we're making an authenticated request to the Firebase Auth API
        const endpoint = `https://identitytoolkit.googleapis.com/v1/projects/${c.env.PROJECT_ID}/accounts`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await serviceAccountCredential.getAccessToken()}`
            },
            body: JSON.stringify({
                email,
                password,
                displayName,
                returnSecureToken: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } };
            return c.json({ 
                message: 'signup failed', 
                error: errorData.error?.message || 'unknown error' 
            }, 400);
        }
        
        const userData = await response.json() as { localId?: string };
        
        return c.json({ 
            message: 'signup successful',
            userId: userData.localId
        }, 201);
    } catch (error) {
        console.error('Signup error:', error);
        return c.json({ message: 'signup error', error: String(error) }, 500);
    }
}

/**
 * Handle session verification
 */
export const handleVerifySession = async (c: HonoContext) => {
    console.log('handleVerifySession!!!', c);
    try {
        // Get the session cookie using Hono's getCookie helper
        const sessionCookie = getCookie(c, 'session');
        
        if (!sessionCookie) {
            return c.json({ 
                authenticated: false,
                message: 'No session cookie found'
            });
        }
        
        // Create service account credential
        const serviceAccountCredential = new ServiceAccountCredential(c.env.SERVICE_ACCOUNT_JSON);
        
        // Initialize auth API client
        const auth = AdminAuthApiClient.getOrInitialize(
            c.env.PROJECT_ID,
            serviceAccountCredential
        );
        
        try {
            // Use the Auth API endpoint to verify the session
            const endpoint = `https://identitytoolkit.googleapis.com/v1/projects/${c.env.PROJECT_ID}/accounts:lookup`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await serviceAccountCredential.getAccessToken()}`
                },
                body: JSON.stringify({
                    idToken: sessionCookie // Use the session cookie as the ID token
                })
            });
            
            if (!response.ok) {
                return c.json({ 
                    authenticated: false,
                    message: 'Invalid session'
                });
            }
            
            const userData = await response.json() as { 
                users?: Array<{
                    localId?: string;
                    email?: string;
                    emailVerified?: boolean;
                    displayName?: string;
                    photoUrl?: string;
                }>
            };
            
            if (!userData.users || userData.users.length === 0) {
                return c.json({ 
                    authenticated: false,
                    message: 'User not found'
                });
            }
            
            const user = userData.users[0];
            
            // Return user information
            return c.json({
                authenticated: true,
                user: {
                    uid: user.localId,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    displayName: user.displayName,
                    photoURL: user.photoUrl
                }
            });
        } catch (verifyError) {
            // Session cookie is invalid
            return c.json({ 
                authenticated: false,
                message: 'Invalid session'
            });
        }
    } catch (error) {
        console.error('Session verification error:', error);
        return c.json({ 
            authenticated: false,
            message: 'Error verifying session',
            error: String(error)
        }, 500);
    }
}