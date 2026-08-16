# F1 layered-message regression evidence

These three reports were exported from the **same v2.29.0 carrier** and preserve the
historical behaviour that later motivated the F1 evidence-normalization fixes.

- wrong test password → no message / no native confirmation;
- test password `1424` → alternative message recovered, but without `nativeExtracted`
  in the historical v2.42.10 output;
- test password `2414` → main message recovered with `nativeExtracted`.

Do not edit the frozen JSON files to make them match current behaviour. Their purpose is
to document the historical regression. The executable compatibility check uses separate
compact binary vectors derived from the same carrier.
