# SALA — Maputo

A mobile-first, scroll-driven website for SALA. The visitor walks from the street, through the door and reception, into the dining room, looks around, and reaches the featured table to request a booking. Every camera move comes from the storyboard photographs.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
npm run preview    # serve the build
```

To connect a real booking service, set `VITE_RESERVATION_ENDPOINT` at build time (see [Reservations](#reservations)).

## Frames

`public/assets/sala/section-01 … section-11/frame-NN.webp` hold 96 frames cropped from the 11 storyboard sheets. They are served from `/assets/sala/...`. To regenerate them:

```bash
python3 scripts/crop_frames.py <folder-with-the-sheet-pngs> public/assets/sala   # needs Pillow + numpy
```

| Section | Sheet | Grid | Frames |
|---|---|---|---|
| 01 Exterior | 4adc0e9c | 4×2 | 8 |
| 02 Approach | ed77ea65 | 4×2 | 8 |
| 03 Door | 8bb60506 | 4×2 | 8 |
| 04 Entering | 7e1c5c4b | 5×2 | 10 |
| 05 Reception | 41cb5ba6 | 4×2 | 8 |
| 06 Bell | fcfb3b7a | 3×2 | 6 |
| 07 Walk | 137b5c4e | 5×2 | 10 |
| 08 Reveal | 6a0e7a4c | 5×2 | 10 |
| 09 Look-around | f8af60e7 | **4×4** | **16** |
| 10 Table | 46fd7a01 | 7×1 | 7 |
| 11 Final view | 3385de9f | 5×1 | 5 |

The script uses the cell boxes measured on each sheet. Where a gutter is not visibly dark (row 1 of sheet 04), it uses the image seam instead. Afterwards it trims up to 3 px of leftover gutter from each edge. Each source frame is roughly 280–660 px on its long side, so there is no separate desktop variant; the browser scales the frames up.

## How it works

- `src/journey/data.ts` defines the chapters and the timeline: which frames play, the scroll distance per frame, the dissolve width, focal points, the look-around frames and hotspot positions.
- `src/journey/engine.ts` maps scroll position to a step on the timeline. It draws the current frame and the next one onto a single `<canvas>` inside a sticky full-screen stage, and redraws only when the scroll position or a loaded image changes (batched with `requestAnimationFrame`). Nothing plays on its own; the frames move only when the page scrolls.
- `src/journey/frames.ts` loads and decodes frames on demand: the 3 opening frames first, then a window of about 3 frames behind and 10 ahead. If a frame is not ready, the nearest decoded frame is shown instead, so quick scrolling never shows a blank frame.
- Transitions: inside a chapter, adjacent frames crossfade over a narrow window. At chapter boundaries where a sheet begins with different framing, the picture dips briefly through dark instead, so two frames are never overlaid. Digital push-in is at most 1.2 % per frame.
- Look-around (section 09): a horizontal drag or swipe, the ← → keys, trackpad sideways scroll or the small buttons change the viewing direction. The stage uses `touch-action: pan-y pinch-zoom`. A mostly vertical gesture is left to the browser and keeps scrolling the page. The view turns only after at least 8 px of mostly horizontal movement. When the gesture ends, the view settles on a single frame. Frame 16 faces the same way as frame 1, so the rotation wraps.
- Hotspot: a discreet marker shows on look-around frames 1, 2, 15 and 16, where the table approached in section 10 is clearly visible. Tapping it scrolls through section 10 to the table. The **Reservar** button in the header is always available.
- Sound starts off. With sound on, the bell (synthesised with Web Audio, no file) rings when the finger presses it in section 06, or when the visitor taps **Tocar a campainha**.
- Accessibility: all controls have labels; the chapter dots are keyboard-focusable and let the visitor jump between chapters. `prefers-reduced-motion` switches dissolves to hard cuts and jumps between chapters without animation. The form uses a native modal `<dialog>` with inline error messages.
- Test hooks: `?debug` exposes the engine as `window.__sala`. `?falha=01-2,03-4` deliberately breaks those frames so the fallback can be checked.

## Reservations

`src/reservations/service.ts` is the integration boundary.

- **Without `VITE_RESERVATION_ENDPOINT`** (current state), the form stores the request only in the browser's `localStorage`. The visitor is told clearly that it is a demonstration, that nothing was sent to the restaurant, and that the booking is **not** confirmed.
- **With `VITE_RESERVATION_ENDPOINT`**, the form POSTs JSON with an `Idempotency-Key` header. It reads `201 {status:"confirmed"|"pending", reference?, table?}`, `409` for a slot taken in the meantime, and `422 {message}` for invalid input. Network failures and timeouts show a retryable error. A booking is shown as "confirmada", and a table number appears, only when the server returns them.

No address, phone number, opening hours, menu or prices are shown, because none were supplied.
