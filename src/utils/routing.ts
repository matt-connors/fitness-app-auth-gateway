import { HonoContext } from "@/src/definitions";
import { firebaseAuthConfig } from "@/src/auth";
import { getFirebaseToken, verifySessionCookieFirebaseAuth } from "@hono/firebase-auth";
import unprotectedRoutes from "../config/unprotectedRoutes";
import type { MiddlewareHandler, Next } from "hono";

/**
 * A set of recently unprotected routes
 */
const recentUnprotectedRoutes = new Set<string>();

/**
 * Protect the routes that require authentication
 */
export const protectAppicableroutesMiddleware: MiddlewareHandler = async (ctx: HonoContext, next: Next) => {

    // If the route is in the known unprotected routes cache, don't bother to redo path checking
    if (recentUnprotectedRoutes.has(ctx.req.path)) {
        return next();
    }

    if (unprotectedRoutes.some(route => matchPath(route, ctx.req.path))) {
        if (recentUnprotectedRoutes.size < 1_000) { // a size of 1,000 should always be less than 50kb
            recentUnprotectedRoutes.add(ctx.req.path);
        }
        return next();
    }

    return verifySessionCookieFirebaseAuth(firebaseAuthConfig)(ctx, next);

}

/**
 * Add the firebase token to the context
 */
export const addFirebaseTokenMiddleware: MiddlewareHandler = async (ctx: HonoContext, next: Next) => {
    ctx.env.firebaseTokenJson = getFirebaseToken(ctx);
    return next();
}

/**
 * Matches a path against a pattern that may contain wildcards
 * 
 * @param pattern The pattern to match against (e.g., "* /folder/**", "** /vendor/**", "/partial**")
 * @param path The actual path to test
 * @returns boolean indicating if the path matches the pattern
 */
export function matchPath(pattern: string, path: string) {

    // Remove any trailing slash from the path
    if (path.endsWith('/')) {
        path = path.slice(0, -1);
    }

    // Handle non-compelx patterns
    if (!pattern.includes('*')) {
        return path === pattern;
    }

    let greedyPathSegments = pattern.split('**').filter(Boolean);
    let firstGreedySegment = greedyPathSegments[0];

    // For patterns that contain /** at some point to match any following segments
    if (!firstGreedySegment.includes('*') && greedyPathSegments.length === 1) {
        return path.startsWith(firstGreedySegment);
    }

    let offset = 0;
    let pathSegments = path.split('/').filter(Boolean);

    return pathSegments.map((pathSegment, index) => {

        // Since greedy segments can match any number of segments, we need to keep looking for the same segment
        let greedySegment = greedyPathSegments[index - offset];

        if (!greedySegment) {
            return false;
        }
        
        // Remove the leading slash from the pattern segment since we split the path by slashes
        greedySegment = greedySegment.replace('/', '');

        if (!greedySegment.includes('*')) {
            if (!pathSegment.startsWith(greedySegment)) {
                offset ++;
                return false;
            }
            return true;
        }
    })
    .filter(Boolean)
    // Ensure the number of matching parts is the same as the number of greedy parts
    .length === greedyPathSegments.length;
}