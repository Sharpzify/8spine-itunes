// 8SPINE Module: LRCLIB Lyrics
// Fetches synced (line-by-line, LRC-timestamped) or plain lyrics for a track
// using LRCLIB's free, public, no-auth API (https://lrclib.net).
// No API key, no login, no rate limit, no scraping of any private/session data.
// Note: LRCLIB primarily provides LINE-synced lyrics. Some entries may include
// word-level timing, so this module checks for that and reports which kind
// of sync it found via the `wordSynced` flag, but most tracks will only have
// line-level sync — that is a data-availability limit of the source, not a bug.

var LRCLIB_BASE = 'https://lrclib.net/api';
var USER_AGENT = '8spine-lrclib-module/1.0.0 (+https://github.com/)';

function buildQuery(params) {
    var parts = [];
    for (var key in params) {
        if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null && params[key] !== '') {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    }
    return parts.join('&');
}

// Parses standard LRC sync format into an array of { time, text } lines.
// Also detects and parses word-level tags if present, e.g.:
//   [00:12.34]<00:12.34>word1<00:12.80>word2<00:13.10>word3
function parseSyncedLyrics(lrcText) {
    if (!lrcText) return { lines: [], hasWordTiming: false };

    var lineRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;
    var wordTagRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>/g;

    var rawLines = lrcText.split('\n');
    var lines = [];
    var hasWordTiming = false;

    for (var i = 0; i < rawLines.length; i++) {
        var raw = rawLines[i];
        var match = raw.match(lineRegex);
        if (!match) continue;

        var lineTime = parseInt(match[1], 10) * 60 + parseFloat(match[2] + '.' + match[3]);
        var rest = match[4];

        if (wordTagRegex.test(rest)) {
            hasWordTiming = true;
            wordTagRegex.lastIndex = 0;

            var words = [];
            var segments = rest.split(wordTagRegex);
            // segments alternates: [textBeforeFirstTag, mm, ss, frac, text, mm, ss, frac, text, ...]
            var cursor = 1;
            while (cursor + 3 <= segments.length) {
                var wMin = segments[cursor];
                var wSec = segments[cursor + 1];
                var wFrac = segments[cursor + 2];
                var wText = segments[cursor + 3] || '';
                if (wMin !== undefined && wSec !== undefined) {
                    words.push({
                        time: parseInt(wMin, 10) * 60 + parseFloat(wSec + '.' + wFrac),
                        text: wText.trim()
                    });
                }
                cursor += 4;
            }
            lines.push({ time: lineTime, text: rest.replace(wordTagRegex, '').trim(), words: words });
        } else {
            lines.push({ time: lineTime, text: rest.trim(), words: null });
        }
    }

    return { lines: lines, hasWordTiming: hasWordTiming };
}

function fetchGet(trackName, artistName, albumName, duration) {
    var qs = buildQuery({
        track_name: trackName,
        artist_name: artistName,
        album_name: albumName,
        duration: duration
    });
    return fetch(LRCLIB_BASE + '/get?' + qs, {
        headers: { 'User-Agent': USER_AGENT }
    }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
    });
}

function fetchSearch(query, trackName, artistName, albumName) {
    var qs = buildQuery({
        q: query,
        track_name: trackName,
        artist_name: artistName,
        album_name: albumName
    });
    return fetch(LRCLIB_BASE + '/search?' + qs, {
        headers: { 'User-Agent': USER_AGENT }
    }).then(function (res) {
        if (!res.ok) return [];
        return res.json();
    });
}

return {
    id: 'lrclib-lyrics',
    name: 'LRCLIB Lyrics',
    version: '1.0.0',
    labels: ['LYRICS', 'SYNCED'],
    description: 'Fetches synced and plain lyrics from LRCLIB, a free and open lyrics database. No login required.',

    // Primary lookup: exact match via track/artist/album/duration.
    // duration should be in seconds if you have it (improves match accuracy).
    getLyrics: function (trackName, artistName, albumName, durationSeconds) {
        return fetchGet(trackName, artistName, albumName, durationSeconds)
            .then(function (data) {
                if (!data || data.instrumental) {
                    return {
                        found: !!data,
                        instrumental: !!(data && data.instrumental),
                        plain: null,
                        synced: null,
                        hasWordTiming: false
                    };
                }

                var parsed = data.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : { lines: [], hasWordTiming: false };

                return {
                    found: true,
                    instrumental: false,
                    trackName: data.trackName,
                    artistName: data.artistName,
                    albumName: data.albumName,
                    duration: data.duration,
                    plain: data.plainLyrics || null,
                    synced: parsed.lines.length ? parsed.lines : null,
                    hasWordTiming: parsed.hasWordTiming
                };
            })
            .catch(function () {
                return { found: false, instrumental: false, plain: null, synced: null, hasWordTiming: false };
            });
    },

    // Fallback lookup: fuzzy search if the exact getLyrics() match fails.
    // Returns a list of candidate matches; caller can pick the best one
    // and re-query getLyrics() with the exact metadata, or use the
    // plain/synced fields directly if present in the search result.
    searchLyrics: function (query, trackName, artistName, albumName) {
        return fetchSearch(query, trackName, artistName, albumName)
            .then(function (results) {
                if (!results || !results.length) return [];
                return results.map(function (r) {
                    var parsed = r.syncedLyrics ? parseSyncedLyrics(r.syncedLyrics) : { lines: [], hasWordTiming: false };
                    return {
                        id: r.id,
                        trackName: r.trackName,
                        artistName: r.artistName,
                        albumName: r.albumName,
                        duration: r.duration,
                        instrumental: !!r.instrumental,
                        plain: r.plainLyrics || null,
                        synced: parsed.lines.length ? parsed.lines : null,
                        hasWordTiming: parsed.hasWordTiming
                    };
                });
            })
            .catch(function () {
                return [];
            });
    }
};
