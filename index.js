import 'dotenv/config.js';
import got from 'got';

const playlistsUrl = (userId) => `https://api.spotify.com/v1/users/${userId}/playlists`;
const tokenUrl = 'https://accounts.spotify.com/api/token';

const { clientId, clientSecret, userId } = process.env;

const main = async () => {
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
  console.log(accessToken);

  const playlistsPaginating = await got.paginate(playlistsUrl(userId), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    pagination: {
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
    },
    searchParams: {
      offset: 0,
      limit: 10,
    },
  });
  for await (const playlist of playlistsPaginating) {
    if (playlist.owner.id === userId) {
      console.log(playlist.name);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});