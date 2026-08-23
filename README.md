# Jellyfin for Samsung Orsay

A Jellyfin client for Samsung Smart TVs running **Orsay** — roughly the 2011–2015
models, before Samsung moved to Tizen.

> Samsung stopped supporting these sets long ago, and this app is unofficial. If
> your TV runs Tizen, use [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung)
> instead. If you have a browser on the TV, the Jellyfin web client may serve you
> better than this.

Verified working against **Jellyfin 10.11** on a 2013 F-series set.

---

## Installing

Use [Jellyfin-Orsay-Installer](https://github.com/segganeadel/Jellyfin-Orsay-Installer),
which packages this folder and serves it to the TV's developer-mode sync:

```bash
uv run orsay-serve.py path/to/Jellyfin-Orsay-App
```

Then on the TV: sign in to Smart Hub as `develop`, open the sync menu, enter the
PC's IP, and start User App Sync.

---

## What the TV can play

Playback decisions are made on the client, from a per-model capability table in
`GuiPlayer_TranscodeParams.js`. For the 2013 F-series that means:

| | |
| --- | --- |
| **Direct play** | H.264 up to High@L4.1, 1080p30, 8-bit, plus MPEG-2/4, VC-1, WMV |
| **Audio** | AAC, MP3, AC-3, E-AC-3, DTS, WMA, PCM |
| **Transcoded** | HEVC, VP9, AV1, 10-bit — the hardware cannot decode these |
| **Containers** | MP4, MKV, AVI, TS, MOV, WMV and friends |

Anything outside that is transcoded to H.264 by the server over HLS.

---

## Notes for anyone working on this

**The browser is from 2011.** WebKit 535, **ES5 only** — no `let`, arrow
functions, `Promise`, `fetch`, `Map`/`Set`, or template literals. `const` parses
but is not real `const`. `XMLHttpRequest.timeout` is silently ignored. There is no
`IndexedDB` and no `performance.now`.

**`alert()` is the logging channel,** not a dialog. `FileLog.write` calls it on
every line and the app remains usable, so the several hundred `alert()` calls in
here are debug output rather than leftovers.

**The TV cannot reach a modern HTTPS server.** Its TLS stack offers only CBC and
RC4 ciphers with RSA certificates, so a server presenting an ECDSA certificate or
requiring AEAD ciphers fails the handshake outright. Use plain HTTP on the LAN, or
put a legacy-TLS reverse proxy in front.

**Getting information off the TV.** There is no console. `FileLog` writes to
`MB3_Log.txt`, viewable under Settings → Log, and the green button there posts the
whole log to the installer's `/report` endpoint — run the installer with `--stay`
so it is still listening.

**There is no native keyboard available to widgets.** `IMEShell` from Samsung's
`ime2.js` is the only keyboard object the firmware exposes to an app of
`<type>user</type>`; the system keyboard belongs to privileged applications like
the Web Browser. This was measured on-device, not assumed. `IMEShell` leaves stray
whitespace in fields, so input is trimmed before use.

---

## Recent work

Audited across correctness, Jellyfin API conformance, and use of the Samsung
platform APIs; the resulting fixes so far:

- **Playback** — MP4 and MKV were being transcoded unnecessarily, because Jellyfin
  reports a container as ffprobe's whole format list (`mov,mp4,m4a,3gp,3g2,mj2`)
  and the comparison expected one name. Transcoded streams could not start at all,
  as the player's HLS marker had been removed. Transcode bitrate is now capped
  rather than requesting 60 Mbit for a 3 Mbit file.
- **Resume points** — `PlayMethod` went unset for audio-only transcodes, so the
  server rejected the playback report and saved no progress.
- **Login** — the on-screen keyboard's stray whitespace made every login fail.
- **Crashes** — fourteen pages dereferenced null instead of navigating back after a
  failed request; three scripts referenced in `index.html` did not exist; the
  unload handler threw on its first line.
- **Data loss** — deleting a server or user removed every later entry as well.
- **Device identity** — all Wi-Fi-only sets reported the same device id, so two TVs
  on one server shared a session and cancelled each other's transcodes.

Still open: error handling around `JSON.parse`, URL encoding of user input,
settings-file caching, and moving playback negotiation to a Jellyfin
`DeviceProfile`.
