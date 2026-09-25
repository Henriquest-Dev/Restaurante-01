# SALA — Maputo

A mobile-first, scroll-driven website for SALA. The visitor opens the door, walks past reception, rings the bell, crosses the dining room and sits at a table, then requests a booking. Scrolling drives the film frame by frame.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
npm run preview    # serve the build
```

To connect a real booking service, set `VITE_RESERVATION_ENDPOINT` at build time (see [Reservations](#reservations)). Pushes to the branch deploy to GitHub Pages (`.github/workflows/pages.yml`).

## The film

The journey is one continuous film, `media/sala.webm` (1920×1080, 39 s, supplied by the client). It is exported as WebP frames at 20 fps in two variants: `wide`, the full frame for landscape screens, and `tall`, a 720×1080 centre crop for phones in portrait:

```bash
FFMPEG=ffmpeg python3 scripts/pipeline/film_frames.py media/sala.webm public/assets/sala/film
```

`src/journey/data.ts` maps the film's scenes to chapters, using time ranges in seconds. The film already fades through black between scenes:

| Chapter | Film | Content |
|---|---|---|
| I A porta | 0–5 s | Hand opens the glass door |
| II A entrada | 5–11.9 s | Walk in towards reception |
| III A campainha | 11.9–15.5 s | Bell pressed, pan across the room |
| IV A sala | 15.5–23.4 s | Dining room reveal |
| V A mesa | 23.4–29 s | Walk to the table |
| VI Sentar | 29–39 s | Sitting down at the table, then reservation |

`pace` sets how many viewport heights of scrolling one second of film takes.

## How it works

- `src/journey/player.ts` maps the scroll position to a film frame and draws it on a full-screen `<canvas>`. The displayed position is eased towards the real scroll position, so the film glides between scroll events. Nothing plays on its own; the film moves only when the visitor scrolls, in either direction.
- `src/journey/sequence.ts` downloads frames around the playhead in priority order: the nearest frames first, then every 4th frame further ahead, so fast swipes still find a nearby frame. About 28 frames are kept decoded as `ImageBitmap`s, so drawing is instant. If the exact frame is not ready, the nearest decoded one is drawn; the screen never goes blank.
- A visitor downloads only one variant, progressively: about 21 MB for phones or 35 MB for desktop in total, never all at once.
- The interface uses GSAP SplitText for the chapter titles, which are scrubbed by scroll, and Lenis for inertial wheel scrolling on desktop. It adds a film letterbox and grain, and hides the scrollbar.
- Sound starts off. With sound on, a synthesised bell rings when the hand presses it (`BELL_AT` in `data.ts`).
- `prefers-reduced-motion` turns off easing and animations. The chapter menu is keyboard accessible.
- `?debug` exposes the player as `window.__sala` for automated checks.

`scripts/crop_frames.py` and `scripts/pipeline/build_media.py` are the earlier storyboard pipeline (Real-ESRGAN upscaling and RIFE interpolation). They are kept for reference and are not used by the current site.

## Reservations

`src/reservations/service.ts` is the integration boundary.

- **Without `VITE_RESERVATION_ENDPOINT`** (current state), the form stores the request only in the browser's `localStorage`. The visitor is told clearly that it is a demonstration, that nothing was sent to the restaurant, and that the booking is **not** confirmed.
- **With `VITE_RESERVATION_ENDPOINT`**, the form POSTs JSON with an `Idempotency-Key` header. It reads `201 {status:"confirmed"|"pending", reference?, table?}`, `409` for a slot taken in the meantime, and `422 {message}` for invalid input. Network failures and timeouts show a retryable error. A booking is shown as "confirmada", and a table number appears, only when the server returns them.

No address, phone number, opening hours, menu or prices are shown, because none were supplied.
