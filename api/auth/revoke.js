// api/auth/revoke.js
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';
import { sql } from '@vercel/postgres'; // Vercel Postgres client

// Your environment variables
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // The revoke link passes the user_id in the query
    const { user_id } = req.query;

    if (!user_id) {
        return res.redirect('/?status=error&message=NoUserId');
    }

    let userAccessToken;

    try {
        // 1. RETRIEVE ACCESS TOKEN FROM POSTGRES
        const { rows } = await sql`
            SELECT access_token FROM users WHERE discord_id = ${user_id};
        `;
        
        if (rows.length === 0) {
            console.log(`User ${user_id} not found in DB.`);
            return res.redirect('/?status=deauthorized'); // Already removed or never authorized
        }

        userAccessToken = rows[0].access_token;
        
        // 2. CALL DISCORD'S REVOCATION API
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            token: userAccessToken, // Revoke the access token
            token_type_hint: 'access_token',
        });

        const revokeResponse = await fetch('https://discord.com/api/oauth2/token/revoke', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        if (revokeResponse.ok) {
            // 3. DELETE TOKEN FROM POSTGRES (Cleanup)
            await sql`
                DELETE FROM users WHERE discord_id = ${user_id};
            `;
            
            console.log(`Successfully revoked and deleted token for user ${user_id}`);
            res.redirect('/?status=deauthorized');
        } else {
            // Even if Discord fails (e.g., token expired), we should still clean up our database.
            await sql`
                DELETE FROM users WHERE discord_id = ${user_id};
            `;
            console.error(`Discord Revocation API failed for ${user_id}. Status: ${revokeResponse.status}`);
            res.redirect('/?status=error&message=RevokeFailed');
        }

    } catch (error) {
        console.error('Revocation Error:', error);
        res.redirect('/?status=error&message=RevokeError');
    }
};
