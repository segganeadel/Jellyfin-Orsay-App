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

The app sends Jellyfin a **DeviceProfile** describing what the panel can decode,
and the server decides how to deliver each file — direct play where possible,
transcoded to H.264 over HLS where not. The limits live in
`GuiPlayer_DeviceProfile.js`, keyed by model year.

For the 2013 F-series that means:

| | |
| --- | --- |
| **Direct play** | H.264 up to High@L4.1, 1080p30, 8-bit, plus MPEG-2/4, VC-1, WMV |
| **Audio** | AAC, MP3, AC-3, E-AC-3, DTS, WMA, PCM |
| **Transcoded** | HEVC, VP9, AV1, 10-bit — the hardware cannot decode these |
| **Containers** | MP4, MKV, AVI, TS, MOV, WMV and friends |

Bitrate is capped at what the panel accepts (30.7 Mbit on F-series) regardless of
the user's setting, and passthrough audio is only advertised when the hardware
confirms it can carry it.

If the server cannot negotiate — an older Jellyfin, or a request that fails — the
app falls back to deciding locally from the same limits table. The
**Let Server Choose Playback** setting turns negotiation off entirely.

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
whitespace in fields, so input is trimmed before use. Because `IMEShell` is drawn
by the app rather than the firmware, its size and position are ours to change.

**The platform cannot be asked what it decodes.** There is no codec capability
call anywhere in the Device API; `OnRenderError` reporting a failure after the
fact is the only signal. That is why the limits are a table rather than a query.

---

## Recent work

Audited across correctness, Jellyfin API conformance, and use of the Samsung
platform APIs. What has been fixed since:

**Playback**
- MP4 and MKV were transcoded unnecessarily, because Jellyfin reports a container
  as ffprobe's whole format list (`mov,mp4,m4a,3gp,3g2,mj2`) and the comparison
  expected one name. Transcoded streams could not start at all, as the player's
  HLS marker had been removed.
- Playback is now negotiated with the server through a DeviceProfile, replacing a
  702-line client-side capability table that had drifted — it claimed HEVC level
  5.1 on H-series panels that stop at 4.0.
- `PlayMethod` went unset for audio-only transcodes, so the server rejected the
  playback report and saved no resume point.
- The picture was sized from the source file before playback began, so anything
  the server rescaled was letterboxed against the wrong dimensions.
- Live TV never released its tuner; buffering was left at firmware defaults.

**Signing in**
- The login screen appeared on every launch: nothing ever marked an account as
  default, and a failure deleted the saved account outright. The access token is
  now kept and reused.
- **Quick Connect** — approve the TV from a phone instead of spelling a password
  out with the remote. Red button on the login screen.
- The on-screen keyboard's stray whitespace made every login fail.

**Audio**
- Whether Dolby or DTS can be passed through is now asked of the hardware rather
  than of the user. Enabling DTS with nothing attached to decode it produced
  silence; output now stays PCM unless a receiver confirms otherwise.

**Robustness**
- Fourteen pages dereferenced null instead of navigating back after a failed
  request; three scripts referenced in `index.html` did not exist; the unload
  handler threw on its first line.
- Deleting a server or user removed every later entry as well.
- All Wi-Fi-only sets reported the same device id, so two TVs on one server shared
  a session and cancelled each other's transcodes.
- The settings file is parsed through one guarded path — a single truncated write
  used to leave the app unusable with no way to clear it from a TV.
- The app no longer refuses to start on a network without internet access.
- User input is escaped into URLs, so a search containing `&` no longer truncates.

**Playing something**

| Key | |
| --- | --- |
| DOWN or TOOLS | Bottom bar: play/pause, chapters, subtitles, audio, position |
| YELLOW | Statistics overlay - how the file is being delivered, and why |
| FF / RW | Scan at 2x, 4x, 8x on a direct play; fixed jumps otherwise |
| INFO | Full item details |

The bar fades after five seconds while playing and stays up while paused.

**Still open**
- Trick play (`SetPlaybackSpeed`), 3D top-and-bottom mode, and a subtitle timing
  offset — all available and unused.
- Reporting capabilities to the server so remote control from another Jellyfin
  client works.
- General performance work, particularly startup: the app does a lot of
  synchronous, blocking work between launch and the first screen.
- Routing the several hundred debug `alert()` calls through `FileLog`, and
  removing the dead code the audit catalogued.
