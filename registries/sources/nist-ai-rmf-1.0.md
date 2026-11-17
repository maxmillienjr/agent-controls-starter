# nist-ai-rmf-1.0: where the ids came from

- Document: NIST AI 100-1, Artificial Intelligence Risk Management Framework (AI RMF 1.0),
  https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf (DOI 10.6028/NIST.AI.100-1).
- Retrieved: 2026-11-17, over verified TLS with a generic User-Agent.
- Bytes fetched (PDF): SHA-256 `7576edb531d9848825814ee88e28b1795d3a84b435b4b797d3670eafdc4a89f1`
- Extraction: `pdftotext -layout NIST.AI.100-1.pdf - | grep -oE '(GOVERN|MAP|MEASURE|MANAGE) [0-9]+\.[0-9]+:' | sort -u`
- Result: 72 subcategory ids from the core's tables: GOVERN 19, MAP 18, MEASURE 22, MANAGE 13.

Only the ids are kept, without the subcategory text. The companion Generative AI Profile
(NIST AI 600-1) is a separate document with its own ids and is not shipped here; add it as
your own registry file if you map to it.
