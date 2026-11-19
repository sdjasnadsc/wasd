# Reef Relay

Reef Relay is a seven-round underwater trivia arcade with original illustrations and a live multiplayer category game. Solve prompts for depth in Daily Descent or pass the puffer before its hidden fuse goes off.

## Run locally

Install **Node.js 24 or newer** with npm. From the project directory, run

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. The Node process serves the frontend, API, and multiplayer connection from the same origin. The default SQLite database is migrated and seeded automatically on startup. The package can be installed offline because its WebSocket dependencies are included under `vendor/`.

## Run from a Chromebook with GitHub Codespaces

Open the project’s GitHub repository in Chrome and select **Code → Codespaces → Create codespace**. Select the **reef-relay** branch or use the [Reef Relay Codespaces link](https://codespaces.new/sdjasnadsc/wasd/tree/reef-relay). The dev container installs the dependencies and starts the game automatically.

Open the **Ports** tab and click **Reef Relay (5173)**. To restart the server manually after stopping it, run `npm run dev` from the repository root. Leave the port private for solo play. For multiplayer, set **Port Visibility → Public** on port 5173 if your GitHub organization permits it, then share a room invitation from the forwarded game page. Use the default HTTP port protocol between Codespaces and the app. The browser-facing link uses HTTPS.

The game is available while the Codespace and server are running. Stopping the Codespace ends active rooms. Saved progress stays in the Codespace’s SQLite file, so reopen the same Codespace to keep it. Deleting the Codespace clears that storage. See [GitHub’s port forwarding guide](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace) and [Codespace lifecycle guide](https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle).

## Play Puffer Relay with two browsers

1. Open `http://localhost:5173/party` in one browser and in a private window or a second browser profile. Each browser profile has its own guest identity.
2. In the host browser, select **Room settings**, choose a capacity, and select **Create room**.
3. Copy the invitation or give the second player the four-letter room code. Join from the second browser and select **I’m ready**.
4. Select **Start game** as the host. Enter **Shark** for the opening ocean-animal category. Both players see the answer and the second player receives the puffer.
5. To play from another device on your local network, use the host computer’s LAN IP address and the same port. Both players should open the same host address before exchanging an invitation.

The default fuse runs for a random 10–30 seconds. Passing preserves it and raises the remaining time to eight seconds when necessary. The server sends broad animation states and keeps the precise deadline private. The server also verifies turn ownership and rejects repeated canonical answers and aliases. Disconnected players have an 18-second reconnection window. Their fuse keeps running during that window.

Quick Play and Rated match actual connected players. The rated queue starts with a 150-point rating band and widens it while players wait. Ratings start at 1,000. For each opponent, compare the player’s finish order with the Elo expected result, average the pairwise differences, multiply by 24, then round. The rating floor is 100.

## Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Start the local app with Node watch mode. |
| `npm run build` | Prepare production browser assets and transpile the shared module. |
| `npm run start` | Serve the production build and multiplayer backend. |
| `npm run typecheck` | Check JavaScript syntax and Node’s TypeScript stripping compatibility. |
| `npm run test` | Run Node unit and integration tests, including actual WebSocket clients. |
| `npm run test:e2e` | Run Playwright browser tests against a temporary production server and database. |
| `npm run seed` | Apply migrations and idempotently seed the trivia and archive data. |

To run the browser suite on a machine with access to npm, install Playwright separately and build first.

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run build
npm run test:e2e
```

Set `PLAYWRIGHT_PACKAGE` to the entry point of an existing Playwright installation or `CHROMIUM_PATH` to an existing compatible Chromium binary if needed.

## Source structure

```text
apps/
  web/                    Browser views, CSS, and original SVG illustrations
  server/
    src/                  HTTP, sessions, trivia, SQLite access, and party rooms
    migrations/           Versioned SQLite schema
packages/shared/          TypeScript contracts, rarity scoring, and answer validation
scripts/                  Build and source checks
tests/                    Node and Playwright tests
vendor/                   Offline WebSocket dependencies and their licenses
```

## Trivia, records, and administration

- Daily Dives reset at midnight in America/New_York. Unfinished official dives close at the reset. Completed results remain available in the profile and archive.
- Each started round keeps a server-side deadline. An accepted answer or timeout records one response. The next deadline begins when the reveal ends or the player selects **Next question**. Toggle **Auto-next** to read the reveal at your own pace.
- The archive contains deterministic daily sets from January 1, 2024. Archive replays, Unlimited, and themed chapters keep their own records. Each of the five themed packs has 30 playable chapters, including Music.
- Friends can see a score once both players finish that day’s official dive. Answer sharing is a separate opt-in setting.
- Set `ADMIN_TOKEN` to a random value of at least 24 characters to open `/admin`. Use it to review private feedback or edit question data. A question edit affects future sets. Previously generated daily, archive, chapter, and active-run sets use their saved snapshots.
- The portable seed bank is in `apps/server/src/bank.ts`. Each row has a prompt and a comma-delimited list of distinct canonical answers. A tilde adds an alias. The list orders answers from accessible to obscure, which assigns one of the six rarity tiers. Preserve existing row order to keep IDs stable. Use the admin interface to assign tiers explicitly. These are curated rarity scores.

## Deploy on one server

Use a persistent Node process and a writable volume. The example below builds the frontend once, then serves it and the WebSocket endpoint from the same Node server.

```sh
npm ci
npm run build
npm run start
```

Configure environment variables in the service manager or copy `.env.example` to `.env`. Set `DATABASE_PATH` to a persistent SQLite path. Behind HTTPS, set `COOKIE_SECURE=true` and `TRUST_PROXY=1` only when requests arrive through a trusted proxy that sets forwarded headers. Set `HOST=127.0.0.1` if a proxy on the same machine should be the only public entry point.

For an Nginx HTTPS virtual host, forward HTTP and WebSocket requests. Put this in the appropriate server and supply your own domain and certificates.

```nginx
location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 70s;
}
```

Use a trusted reverse proxy and keep the SQLite volume backed up with SQLite’s online backup APIs or a consistent filesystem snapshot. SIGINT and SIGTERM close rooms and database connections. Active rooms live in memory and end when the process stops. Match results and rating changes are stored in SQLite.

For multiple instances, move identity, history, and ratings to a shared database. Replace SQLite migration syntax with PostgreSQL equivalents. Put room and queue state under a single authoritative owner per room, route events through a shared broker, and use sticky or owner-aware routing for WebSocket traffic. This version operates on one Node process.

## Implementation notes

The local build uses browser-native JavaScript, CSS, and SVG, with a TypeScript Node server, prepared SQLite statements, and a vendored RFC 6455 WebSocket driver. The TypeScript check verifies syntax and compatibility with Node’s native type stripping.
