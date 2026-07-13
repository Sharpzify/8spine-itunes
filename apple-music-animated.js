// Apple Music Animated Artwork Module (ES5 syntax rewrite)
// This module scrapes the Apple Music web client token and uses it to fetch animated artwork.
// Logic is unchanged from the original — only syntax was converted (const/let -> var,
// arrow functions -> function expressions) to test compatibility with an ES5-only loader.

var TOKEN_STORAGE_KEY = 'apple_music_web_token';

function getWebToken() {
    return AsyncStorage.getItem(TOKEN_STORAGE_KEY).then(function (cachedToken) {
        if (cachedToken) {
            return cachedToken;
        }

        console.log('Fetching new Apple Music Web Token...');
        return fetch('https://music.apple.com/us/browse')
            .then(function (response) { return response.text(); })
            .then(function (html) {
                var indexJsRegex = /crossorigin src="(\/assets\/index.+?\.js)"/;
                var match = html.match(indexJsRegex);

                if (!match || !match[1]) {
                    throw new Error('Could not find index.js in Apple Music HTML');
                }

                var jsUrl = 'https://music.apple.com' + match[1];
                return fetch(jsUrl);
            })
            .then(function (jsResponse) { return jsResponse.text(); })
            .then(function (jsContent) {
                var tokenRegex = /(eyJ(?:hbGc|0eXAi).+?)"/;
                var tokenMatch = jsContent.match(tokenRegex);

                if (!tokenMatch || !tokenMatch[1]) {
                    throw new Error('Could not find Bearer token in Apple Music JS');
                }

                var token = tokenMatch[1];
                return AsyncStorage.setItem(TOKEN_STORAGE_KEY, token).then(function () { return token; });
            })
            .catch(function (error) {
                console.error('Error getting Apple Music Web Token:', error);
                return null;
            });
    });
}

function fetchWithToken(url) {
    return getWebToken().then(function (token) {
        if (!token) return 'ERROR';

        return fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Origin': 'https://music.apple.com'
            }
        }).then(function (res) {
            if (res.status === 401) {
                console.log('Token expired, refreshing...');
                return AsyncStorage.removeItem(TOKEN_STORAGE_KEY)
                    .then(function () { return getWebToken(); })
                    .then(function (newToken) {
                        if (newToken) {
                            return fetch(url, {
                                headers: {
                                    'Authorization': 'Bearer ' + newToken,
                                    'Origin': 'https://music.apple.com'
                                }
                            });
                        }
                        return { status: 401 };
                    });
            }
            return res;
        });
    });
}

return {
    id: "apple-music-animated-scraper",
    name: "Apple Music Animated (Web Scraper)",
    version: "1.0.0",
    description: "Fetches animated album and artist artwork by scraping the Apple Music web client.",

    getAnimatedArtwork: function (albumId, country, type) {
        country = country || 'us';
        type = type || 'tall';
        var url = 'https://amp-api.music.apple.com/v1/catalog/' + country + '/albums/' + albumId + '?extend=editorialVideo';
        return fetchWithToken(url)
            .then(function (response) {
                if (response === 'ERROR' || !response.ok) return null;
                return response.json();
            })
            .then(function (json) {
                if (!json || !json.data || !json.data[0] || !json.data[0].attributes || !json.data[0].attributes.editorialVideo) {
                    return null;
                }
                var editorialVideo = json.data[0].attributes.editorialVideo;

                var videoData = null;
                if (type === 'square') {
                    videoData =
                        editorialVideo.motionDetailSquare ||
                        editorialVideo.motionSquareVideo1x1 ||
                        editorialVideo.motionDetailTall ||
                        editorialVideo.motionArtistFullscreen16x9;
                } else {
                    videoData =
                        editorialVideo.motionDetailTall ||
                        editorialVideo.motionArtistFullscreen16x9 ||
                        editorialVideo.motionDetailSquare;
                }

                return videoData && videoData.video ? videoData.video : null;
            })
            .catch(function (e) {
                console.error("Error fetching album artwork", e);
                return null;
            });
    },

    getAnimatedArtistArtwork: function (artistId, country, type) {
        country = country || 'us';
        type = type || 'tall';
        var url = 'https://amp-api.music.apple.com/v1/catalog/' + country + '/artists/' + artistId + '?extend=editorialVideo';
        return fetchWithToken(url)
            .then(function (response) {
                if (response === 'ERROR' || !response.ok) return null;
                return response.json();
            })
            .then(function (json) {
                if (!json || !json.data || !json.data[0] || !json.data[0].attributes || !json.data[0].attributes.editorialVideo) {
                    return null;
                }
                var editorialVideo = json.data[0].attributes.editorialVideo;

                var videoData = null;
                if (type === 'square') {
                    videoData =
                        editorialVideo.motionArtistSquare1x1 ||
                        editorialVideo.motionSquareVideo1x1 ||
                        editorialVideo.motionArtistFullscreen16x9;
                } else {
                    videoData =
                        editorialVideo.motionArtistFullscreen16x9 ||
                        editorialVideo.motionArtistSquare1x1;
                }

                return videoData && videoData.video ? videoData.video : null;
            })
            .catch(function (e) {
                console.error("Error fetching artist artwork", e);
                return null;
            });
    }
};
