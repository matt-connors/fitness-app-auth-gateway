import { HonoContext } from "@/src/definitions";
import { createAuthHeaders, createTrustedEnvHeaders } from "@/src/utils/fetch";

/**
 * Handle routing in the dashboard service
 */
export const handleGraphql = async (c: HonoContext) => {

    const firebaseTokenJson = c.env.firebaseTokenJson;

    return c.env.FITNESS_APP_GRAPHQL.fetch(c.req.url, {
        method: c.req.method,
        headers: createAuthHeaders(firebaseTokenJson)
    })
}
