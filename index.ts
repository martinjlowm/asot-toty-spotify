import fetch from 'node-fetch';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import SpotifyWebApi from 'spotify-web-api-node';

const spotifyApi = new SpotifyWebApi();

async function extractAccessToken() {
  const browser = await puppeteer.launch({ headless: false });

  const [page] = await browser.pages();

  await page.setRequestInterception(true);

  const findAccessTokenPromise = new Promise<string>((resolve) => {
    page.on('request', (request) => {
      const url = request.url();

      if (url.includes('spclient.spotify.com')) {
        const { authorization = '' } = request.headers();

        const [, accessToken] = authorization.split('Bearer ');

        // NOTE: Initial requests towards spclient.spotify.com use some short
        // token - I don't know what it's used for...
        if (accessToken && accessToken.length === 292) {
          resolve(accessToken);
        }
      }

      request.continue();
    });
  });

  await page.goto('https://open.spotify.com', {
    waitUntil: 'networkidle2',
  });

  const accessToken = await findAccessTokenPromise;

  await browser.close();

  return accessToken;
}

async function extractSongs() {
  const response = await fetch('https://vote.astateoftrance.com');
  const index = await response.text();

  const $ = cheerio.load(index);

  const songTable = $('#main > #content > table > tbody');

  return songTable
    .children()
    .toArray()
    .map((item) => {
      return $('td', item)
        .toArray()
        .map((item) => $(item).text().trim());
    });
}

const dropTerms = (part: string) => {
  return part.replace(/([ \(]feat. | x | & | with | pres. | vs |[ \(]ft. | meets | and |, )/gi, ' ')
    .replace(/’/, "'")
    .replace(/(\(|\))/g, '');
}

async function main() {
  let accessToken: string | undefined = process.env.ACCESS_TOKEN;

  spotifyApi.setAccessToken(accessToken || await extractAccessToken());

  const [year] = new Date().toISOString().split('-');

  const desiredPlaylistName = ['ASOT TOTY', year].join(' ');

  const { body: { items: playlists } } = await spotifyApi.getUserPlaylists();

  const existingPlaylist = playlists.find((playlist) => {
    return playlist.name === desiredPlaylistName;
  });

  const playlist = existingPlaylist || (await spotifyApi.createPlaylist(desiredPlaylistName)).body;

  const existingTracks: string[] = [];

  let nextPage: { limit: number, offset: number } | undefined;
  do {
    const tracks = await spotifyApi.getPlaylistTracks(playlist.id, nextPage);

    const { limit, offset, total, items } = tracks.body;

    nextPage = existingTracks.length !== total ? { limit, offset: offset + limit } : undefined;

    existingTracks.push(...items.map((item) => item.track.uri));
  } while (nextPage);

  const existingTrackSet = new Set(existingTracks);

  const allSongs = await extractSongs();

  for (const [artist, title, remix] of allSongs.map((song) => song.map(dropTerms))) {
    const { body: { tracks } } = await spotifyApi.search([artist, title, remix].join(' '), ['track']);

    if (!tracks || !tracks.items.length) {
      console.warn('! Found no tracks for', { artist, title, remix });

      continue;
    }

    const [prominentTrack] = tracks.items;
    const [prominentArtist] = prominentTrack.artists;

    if (!existingTrackSet.has(prominentTrack.uri)) {
      console.log('» Adding', prominentArtist.name, prominentTrack.name);
      await spotifyApi.addTracksToPlaylist(playlist.id, [prominentTrack.uri]);
    }
  }

}

main();
