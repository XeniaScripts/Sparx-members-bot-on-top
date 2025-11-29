// api/auth/callback.js
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';

// 🛑 WARNING: This in-memory object is NOT secure or scalable. 
// For production, REPLACE THIS with a proper database (e.g., Vercel Postgres, MongoDB).
const database = { users: {} };

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { code } = req.query;

    if (!code) {
        return res.redirect('/?status=error&message=NoCode');
    }

    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI, TARGET_GUILD_ID } = process.env;

    try {
        // --- 1. EXCHANGE CODE FOR TOKENS ---
        const tokenParams = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_REDIRECT_URI,
            scope: 'identify guilds.join'
        });

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const { access_token, refresh_token } = await tokenResponse.json();

        // --- 2. GET USER INFO ---
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const user = await userResponse.json();
        const user_id = user.id;

        // --- 3. ADD USER TO GUILD ---
        await fetch(`https://discord.com/api/v10/guilds/${TARGET_GUILD_ID}/members/${user_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: access_token })
        });
        
        // --- 4. PERSIST TOKENS (MUST BE REPLACED) ---
        // Storing the tokens so we can use them for deauthorization later
        database.users[user_id] = { access_token, refresh_token, user_id };

        // --- 5. REDIRECT TO SUCCESS ---
        // In a production app, you would set a session/cookie here
        res.redirect(`/?status=joined&user_id=${user_id}`);

    } catch (error) {
        console.error('Discord Auth Error:', error);
        res.redirect('/?status=error&message=AuthFailed');
    }
};
