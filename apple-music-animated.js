// 8SPINE Module: Apple Music Animated (Web Scraper)
// Scrapes the Apple Music web client's internal Bearer token and uses it to
// fetch animated album/artist artwork from Apple's internal amp-api catalog.
// Note: unlike a public API (e.g. iTunes Search), this relies on an
// undocumented internal endpoint and a token scraped from Apple's web client,
// so it may break if Apple changes their web client internals.

const TOKEN_STORAGE_KEY = 'apple_music_web_token';

async function getWebToken() {
    const cachedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (cachedToken) {
        return cachedToken;
    }

    console.log('Fetching new Apple Music Web Token...');
    try {
        const pageRes = await fetch('https://music.apple.com/us/browse');
        const html = await pageRes.text();

        const indexJsMatch = html.match(/crossorigin src="(\/assets\/index.+?\.js)"/);
        if (!indexJsMatch || !indexJsMatch[1]) {
            throw new Error('Could not find index.js in Apple Music HTML');
        }

        const jsUrl = 'https://music.apple.com' + indexJsMatch[1];
        const jsRes = await fetch(jsUrl);
        const jsContent = await jsRes.text();

        const tokenMatch = jsContent.match(/(eyJ(?:hbGc|0eXAi).+?)"/);
        if (!tokenMatch || !tokenMatch[1]) {
            throw new Error('Could not find Bearer token in Apple Music JS');
        }

        const token = tokenMatch[1];
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
        return token;
    } catch (error) {
        console.error('Error getting Apple Music Web Token:', error);
        return null;
    }
}

async function fetchWithToken(url) {
    const token = await getWebToken();
    if (!token) return null;

    let res = await fetch(url, {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Origin': 'https://music.apple.com',
        },
    });

    if (res.status === 401) {
        console.log('Token expired, refreshing...');
        await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
        const newToken = await getWebToken();
        if (!newToken) return null;
        res = await fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + newToken,
                'Origin': 'https://music.apple.com',
            },
        });
    }

    return res.ok ? res : null;
}

function pickVideo(editorialVideo, type, isArtist) {
    let videoData = null;
    if (isArtist) {
        videoData = (type === 'square')
            ? (editorialVideo.motionArtistSquare1x1 || editorialVideo.motionSquareVideo1x1 || editorialVideo.motionArtistFullscreen16x9)
            : (editorialVideo.motionArtistFullscreen16x9 || editorialVideo.motionArtistSquare1x1);
    } else {
        videoData = (type === 'square')
            ? (editorialVideo.motionDetailSquare || editorialVideo.motionSquareVideo1x1 || editorialVideo.motionDetailTall || editorialVideo.motionArtistFullscreen16x9)
            : (editorialVideo.motionDetailTall || editorialVideo.motionArtistFullscreen16x9 || editorialVideo.motionDetailSquare);
    }
    return videoData && videoData.video ? videoData.video : null;
}

const MODULE = {
    id: 'apple-music-animated-scraper',
    name: 'Apple Music Animated (Web Scraper)',
    version: '1.0.0',
    labels: ['ARTWORK', 'ANIMATED'],
    description: 'Fetches animated album and artist artwork by scraping the Apple Music web client.',

    getAnimatedArtwork: async (albumId, country, type) => {
        country = country || 'us';
        type = type || 'tall';
        const url = `https://amp-api.music.apple.com/v1/catalog/${country}/albums/${albumId}?extend=editorialVideo`;
        try {
            const res = await fetchWithToken(url);
            if (!res) return null;
            const json = await res.json();
            const editorialVideo = json && json.data && json.data[0] && json.data[0].attributes && json.data[0].attributes.editorialVideo;
            if (!editorialVideo) return null;
            return pickVideo(editorialVideo, type, false);
        } catch (e) {
            console.error('Error fetching album artwork', e);
            return null;
        }
    },

    getAnimatedArtistArtwork: async (artistId, country, type) => {
        country = country || 'us';
        type = type || 'tall';
        const url = `https://amp-api.music.apple.com/v1/catalog/${country}/artists/${artistId}?extend=editorialVideo`;
        try {
            const res = await fetchWithToken(url);
            if (!res) return null;
            const json = await res.json();
            const editorialVideo = json && json.data && json.data[0] && json.data[0].attributes && json.data[0].attributes.editorialVideo;
            if (!editorialVideo) return null;
            return pickVideo(editorialVideo, type, true);
        } catch (e) {
            console.error('Error fetching artist artwork', e);
            return null;
        }
    },
};

return MODULE;
