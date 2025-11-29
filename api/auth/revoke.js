// api/auth/revoke.js
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';

// 🛑 WARNING: This in-memory object is NOT secure or scalable. 
// For production, REPLACE THIS with a proper database (e.g., Vercel Postgres, MongoDB).
const database = { users: {} }; // This MUST load the tokens saved in callback.js

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;
    
    // 🛑 IMPORTANT: In a real app, you must securely get the user's ID from a session/cookie
    // For this minimal example, we use a hardcoded user ID.
    const user_id = 'DUMMY_USER_ID'; 
    
    // You would load the user's ID from session/cookie, then lookup the token
    const refreshToken = database.users[user_id]?.refresh_token; 
    
    if (!refreshToken) {
        return res.redirect('/?status=error&message=NotAuthorized');
    }

    try {
        // --- 1. REVOKE TOKEN on Discord's side ---
        const revokeParams = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            token: refreshToken 
        });

        await fetch('https://discord.com/api/oauth2/token/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: revokeParams.toString()
        });

        // --- 2. DATABASE CLEANUP (MUST BE REPLACED) ---
        // Always delete tokens locally after revoking them remotely.
        delete database.users[user_id]; 
        
        // --- 3. REDIRECT TO CONFIRMATION ---
        res.redirect('/?status=deauthorized');

    } catch (error) {
        console.error('Discord Revoke Error:', error);
        // Even if the revoke call fails, we assume the user wanted to deauthorize and clean our database.
        delete database.users[user_id]; 
        res.redirect('/?status=error&message=RevokeFailed');
    }
};
