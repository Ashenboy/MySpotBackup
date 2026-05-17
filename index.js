const crypto = require('crypto')
const path = require('path')
const express = require('express')
const {stringify} = require("querystring");
const config = require("./public/config")

const app = express()
const codeVerifier = generateRandomString(128);

function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const digest = crypto.createHash('sha256').update(codeVerifier).digest();
    return Buffer.from(digest).toString('base64url');
}

app.use(express.static(path.join(__dirname, 'public')))

app.get('/login', async function (req, res) {
    res.redirect('https://accounts.spotify.com/authorize?' + stringify({
        response_type: 'code',
        client_id: config.client_id,
        scope: 'user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-library-read user-library-modify user-follow-read user-follow-modify',
        redirect_uri: config.callback_uri,
        state: generateRandomString(16),
        code_challenge_method: "S256",
        code_challenge: await generateCodeChallenge(codeVerifier),
    }));
});


app.get('/callback', async function (req, res) {

    var code = req.query.code || null;
    var state = req.query.state || null;

    if (state === null) {
        res.redirect('/#' + stringify({error: 'state_mismatch'}));
    } else {
        const {token, error} = await getAccessToken(code);
        if (error) {
            return res.send(`Error during getAccessToken: ${error}, probably a invalid session. Restart your server and go to the <a href="/">Home Page</a>`);
        }
        res.send(`Congrats! Your Code is <br/>  ${code} <br/> and the token is <br/> ${token}<br/> , submitting to parent page now.` + `<script type='text/javascript'>window.onload = () => { console.log("posting", "${{token}}", "${config.uri}"); window.opener.postMessage({token:"${token}"}, "${config.uri}");}</script>`);
    }
});

async function getAccessToken(code) {
    const payload = {
        method: 'POST', headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }, body: new URLSearchParams({
            client_id: config.client_id,
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.callback_uri,
            code_verifier: codeVerifier,
        }),
    }

    const response = await fetch("https://accounts.spotify.com/api/token", payload);
    const responseBody = await response.json();

    const {access_token, error} = responseBody;
    return {token: access_token, error};
}


const port = process.env.PORT || config.port;
app.listen(port, '0.0.0.0', () => {
    console.log(`MySpotBackup is running on port ${port}`, config);
})
