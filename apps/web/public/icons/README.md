# PWA Icons

Place the following PNG files here for full PWA support:

- icon-192.png  (192×192)
- icon-512.png  (512×512)

Generate them from favicon.svg with:
  npx sharp-cli --input ../favicon.svg --output icon-192.png resize 192 192
  npx sharp-cli --input ../favicon.svg --output icon-512.png resize 512 512

Or use any SVG-to-PNG tool. The app still works without them —
the browser will fall back to the SVG favicon.
