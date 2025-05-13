/**
 * A list of unprotected routes.
 */
export default [
    '/login',
    '/login_session', // This shouldn't matter since its handled before this point, but just in case
    '/logout',
    '/signup',
    '/verify-session',

    // Unless we serve the /login page as a non-astro, we need to allow these routes
    // TODO: Add middleware to the wp-dashboard to check for auth headers + trusted env secret
    "/@**",
    "/node_modules/**",
    "/src/**",
    
    "/favicon**",
    "/fonts/**",
    "/images/**",
    "/_astro/**",

    // "**/*.png"
];