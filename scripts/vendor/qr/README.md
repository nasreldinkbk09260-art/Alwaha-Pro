# Offline QR libraries bundled for Alwaha-Pro

The game-room QR feature uses two pinned, locally bundled browser libraries. They are minified during the existing web build; no CDN or runtime download is used.

- **jsQR** — Apache License 2.0. Source: https://github.com/cozmo/jsQR/blob/8e6a036beafa7053dd44b1b76ac578d22b1b3311/dist/jsQR.js
  - Upstream commit: `8e6a036beafa7053dd44b1b76ac578d22b1b3311`
  - Upstream file blob: `99ea9df26907009e5553233ffe03c529c1521739`
- **qrcode-generator** — MIT License. Source: https://github.com/kazuhikoarase/qrcode-generator/blob/83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/js/dist/qrcode.js
  - Upstream commit: `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8`
  - Upstream file blob: `df13f829bf41f36b82f0ed85751ed3b4c39cfeb8`

The application QR payload contains only the protocol version, game key, and six-character room code. It does not contain a user ID, token, email, or credential. Joining is still validated by the authenticated `join_game_room` RPC and its expected game ID.
