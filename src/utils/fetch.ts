/**
 * Create the auth headers for the request
 */
export const createAuthHeaders = (firebaseTokenJson: any) => {
    return {
        'x-user-id': firebaseTokenJson?.user_id,
        'x-user-email': firebaseTokenJson?.email,
        'x-user-name': firebaseTokenJson?.name,
        'x-user-picture': firebaseTokenJson?.picture,
    }
}

/**
 * Create the auth headers for a TRUSTED_ENV_SECRET request
 */
export const createTrustedEnvHeaders = (trustedEnvSecret: string) => {
    return {
        'x-trusted-env-secret': trustedEnvSecret,
    }
}