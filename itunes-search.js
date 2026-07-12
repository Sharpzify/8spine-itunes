// 8SPINE Module: iTunes Search (Previews)
// Metadata + 30s preview streaming via Apple's public iTunes Search API.
// Uses Apple's officially public, unauthenticated endpoints — intended by
// Apple for exactly this kind of third-party search/preview use case.

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

function upscaleArtwork(url) {
    if (!url) return url;
    return url.replace('100x100', '600x600');
}

const MODULE = {
    id: 'itunes-search',
    name: 'iTunes Search (Previews)',
    version: '1.0.0',
    labels: ['METADATA', 'PREVIEW', '30s'],

    // Search Apple's catalog and map results to the 8SPINE track format.
    searchTracks: async (query, limit) => {
        const params = new URLSearchParams({
            term: query,
            media: 'music',
            entity: 'song',
            limit: String(limit || 25),
        });

        const res = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`);
        const data = await res.json();

        const tracks = (data.results || []).map((item) => ({
            id: item.trackId,
            title: item.trackName,
            artist: item.artistName,
            album: item.collectionName,
            duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : null,
            albumCover: upscaleArtwork(item.artworkUrl100),
        }));

        return { tracks, total: tracks.length };
    },

    // Look the track back up by ID to get its official preview URL.
    getTrackStreamUrl: async (trackId, quality) => {
        const params = new URLSearchParams({ id: String(trackId) });
        const res = await fetch(`${ITUNES_LOOKUP_URL}?${params.toString()}`);
        const data = await res.json();
        const result = (data.results || [])[0];

        if (!result || !result.previewUrl) {
            throw new Error('No preview available for this track');
        }

        return {
            streamUrl: result.previewUrl,
            track: {
                id: trackId,
                // Apple's public API only exposes 30s previews, not full tracks.
                audioQuality: 'PREVIEW',
            },
        };
    },
};

return MODULE;
