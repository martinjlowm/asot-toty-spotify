# ASOT TOTY playlist generator

It turns out this year's "listen" column on https://vote.astateoftrance.com/
isn't functional.

This script scrapes the table and creates/populates a playlist on your account
with all the songs that are available on Spotify.


## Installation

```
npm ci
```


## Usage

Run:
```
npx ts-node index.ts
```

A browser window will open for https://open.spotify.com/ to get an access token
for your user which is used to create and populate said playlist.


## Other

If you are just looking for the playlist, you can find it here:
https://open.spotify.com/playlist/37E0Uyy4pOUp5yxglPNq7S?si=4c37605345234d34
