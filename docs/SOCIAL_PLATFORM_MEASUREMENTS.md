# Social-platform image measurements

STEGO·STUDIO's sturdier JPEG mode is based on **measured platform behaviour**, not on a
claim that any social network has a permanent or universal image pipeline.

The measurements below summarize controlled tests performed in July 2026. Platforms can
change their processing rules at any time, and different upload paths (feed, direct
message, document/file upload, app vs. browser) can behave differently.

## What the measurements established

### WhatsApp

- In tested photo-upload paths, larger JPEGs were resized and/or recompressed.
- A 1200×800 JPEG was observed to keep its dimensions while being normalized by the
  platform; 3000×2000 inputs were reduced in the tested standard/HD paths.
- A later 1080×720 field test returned byte-identical JPEGs in that specific workflow,
  showing that processing is conditional rather than universal.
- Sending a PNG as a **document/file** preserved the file and its LSB payload in the
  tested end-to-end case. This remains the recommended way to preserve pixel-domain
  steganography.

### X

- Tested images were sometimes preserved at the coefficient level and sometimes
  recompressed. The behaviour was not stable enough to justify a universal “lossless”
  claim.
- Some returned JPEGs were progressive.
- Because X can preserve the source quantization tables, quantization alone is not a
  reliable platform fingerprint.

### Facebook

- In the tested feed path, 1200×800 kept its dimensions while 3000×2000 was reduced to
  2048×1365.
- Returned JPEGs were progressive in the measured samples.
- Compression was materially stronger than in the original high-quality JPEGs.

### Instagram

- In the tested direct-message path, both tested source sizes returned as 1080×720.
- Returned JPEGs were baseline in those samples and showed the strongest quantization of
  the four measured platforms.

## The 1080-pixel working envelope

A later field round used 1080×720 carriers and all ten returned files kept that exact
size in the tested workflows. This made 1080 px a practical working envelope for the
sturdier mode: it reduces the risk that a platform first resizes the carrier and shifts
its JPEG block structure.

This is a **measured boundary, not a guarantee**. The application therefore describes
its robust/sturdier behaviour in terms of tested workflows and does not promise survival
through every future upload path.

## Why PNG LSB and sturdier JPEG are different

Pixel-domain LSB data is fragile under ordinary JPEG recompression. If a platform turns a
PNG photo into JPEG, the LSB payload is expected to be destroyed. File/document transfer
can preserve the original PNG exactly.

The sturdier mode instead places its payload in JPEG DCT coefficients with redundancy and
error correction chosen from the measured damage envelope. It trades stealth for channel
survivability and should not be interpreted as undetectable.
