// utils/helpers/generateToken.ts
// ─────────────────────────────────────────────
// LEGACY TOKEN HELPER
// ⚠️  DEPRECATED — Use utils/jwt.ts instead
//    This file is retained for backward compatibility
//    with any legacy routes still referencing it.
//    All new code should use:
//      signAdminToken / signUserToken  from utils/jwt.ts
//      hashToken / generateToken       from utils/hash.ts
// ─────────────────────────────────────────────

import { Response } from "express";
import jwt from 'jsonwebtoken'


// ─────────────────────────────────────────────
// SECURITY NOTE
// JWT_SECRET and REFRESH_TOKEN_SECRET are read
// at call-time (not module-load) to avoid errors
// if env vars haven't been loaded yet.
// Never log secrets — previous version leaked
// them via console.log at import time.
// ─────────────────────────────────────────────

export const generateToken = (res: Response, userId: string, roleId: number) => {
    const jwtSecret = process.env["JWT_SECRET"];
    const refreshSecret = process.env["REFRESH_TOKEN_SECRET"];

    if (!jwtSecret || !refreshSecret) {
        throw new Error("JWT_SECRET or REFRESH_TOKEN_SECRET is not defined in environment variables");
    }

    try {
        // Short-lived access token — 45 minutes
        const accessToken = jwt.sign({ userId, roleId }, jwtSecret, { expiresIn: "45m" })
        // Long-lived refresh token — 30 days
        const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: "30d" })

        // Set Access Token as HTTP-Only secure cookie
        res.cookie("access_token", accessToken, {
            httpOnly: true,
            secure: process.env["NODE_ENV"] !== "development",
            sameSite: "strict",
            maxAge: 45 * 60 * 1000, // 45 minutes
        });

        // Set Refresh Token as HTTP-Only secure cookie
        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: process.env["NODE_ENV"] !== "development",
            sameSite: "strict",
            maxAge: 30 * 24 * 60 * 1000, // 30 days
        });

        return { accessToken, refreshToken }

    } catch (error) {
        console.error("Error generating JWT:", error);
        throw new Error("Error generating authentication tokens");
    }
}