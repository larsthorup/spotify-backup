import 'dotenv/config.js';
import * as fs from 'fs';
import got from 'got';
import slug from 'slug';

const playlistsUrl = (userId) => `https://api.spotify.com/v1/users/${userId}/playlists`;
const playlistTracksUrl = (playlistId) => `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
const tokenUrl = 'https://accounts.spotify.com/api/token';

const { clientId, clientSecret, userId } = process.env;

const authenticating = async () => {
  const credential = `${clientId}:${clientSecret}`;
  const credentialEncoded = new Buffer(credential).toString('base64');
  const tokenResponding = got.post(tokenUrl, {
    form: {
      grant_type: 'client_credentials',
    },
    headers: {
      'Authorization': `Basic ${credentialEncoded}`,
    },
  });
  const { access_token: accessToken } = await tokenResponding.json();
  return { accessToken };
}

const gettingList = ({ accessToken, url }) => {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };
  const pagination = {
    paginate: (response, allItems, currentItems) => {
      const previousSearchParams = response.request.options.searchParams;
      const previousOffset = Number(previousSearchParams.get('offset'));
      const limit = Number(previousSearchParams.get('limit'));
      if (currentItems.length < limit) {
        return false;
      } else {
        const offset = previousOffset + limit;
        return {
          searchParams: {
            ...previousSearchParams,
            offset,
          }
        };
      }
    },
    transform: (response) => {
      return JSON.parse(response.body).items;
    }
  };
  const searchParams = {
    offset: 0,
    limit: 10,
  };
  return got.paginate(url, { headers, pagination, searchParams });
}

const gettingPlaylistList = ({ accessToken }) => {
  const url = playlistsUrl(userId);
  return gettingList({ accessToken, url })
};

const gettingPlaylistTrackList = ({ accessToken, playlistId }) => {
  const url = playlistTracksUrl(playlistId);
  return gettingList({ accessToken, url });
};

const main = async () => {
  const { accessToken } = await authenticating()
  const playlistListGetting = gettingPlaylistList({ accessToken });
  await fs.promises.mkdir('output', { recursive: true });
  for await (const playlist of playlistListGetting) {
    if (playlist.owner.id === userId) {
      console.log(playlist.name);
      const trackList = [];
      const { id: playlistId } = playlist;
      const trackListGetting = gettingPlaylistTrackList({ accessToken, playlistId });
      for await (const item of trackListGetting) {
        trackList.push(item.track);
      }
      const playlistPath = `output/${slug(playlist.name)}.json`;
      await fs.promises.writeFile(playlistPath, JSON.stringify({
        name: playlist.name,
        trackList
      }, null, 2));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});