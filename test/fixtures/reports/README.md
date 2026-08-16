# Frozen forensic-report fixtures

These JSON files are browser exports kept as regression inputs. They are deliberately
frozen: changing historical outputs would weaken their value as compatibility fixtures.

The corpus includes clean controls, native PNG extraction with correct/incorrect test
passwords, sturdier-mode JPEG cases, and layered-message reports. Some files are in
Portuguese because they preserve the locale in which the historical export was made.

The passwords and plaintexts present in these fixtures are **test data only**.
The historical fixture named `Carmen_Mendoza.png` is an AI-generated test image;
its Trufo CA address and certificate fields are metadata preserved from the
original C2PA artifact, not project contact details or secrets.

## Public-schema regression corpus

The v2.42.17 additions contain two valid layered-message exports and one sturdier-mode
JPEG export. The public-schema coverage check projects these frozen reports through
`PUBLIC_REPORT_SCHEMA` and requires every previously public leaf path to survive.

Do not regenerate the frozen historical files merely to normalize wording or formatting.

The `deepscan_strong_embedding_false_text_v2.42.23.json` fixture preserves a sanitized
v2.42.23 report in which strong LSB Replacement evidence coincided with an accidental
printable ciphertext island. It exists to enforce a separate invariant: evidence that
embedding occurred must not, by itself, authenticate a particular string as recovered
content.
