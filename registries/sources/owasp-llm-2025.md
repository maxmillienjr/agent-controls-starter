# owasp-llm-2025: where the ids came from

- URL: https://genai.owasp.org/llm-top-10/
- Retrieved: 2026-11-17, over verified TLS with a generic User-Agent.
- Bytes fetched (HTML): SHA-256 `10caad35da19042bcc437246dd9cbc98419df0b22faa6b7afc739ace991ff9b6`
- Extraction: `grep -oE 'LLM[0-9]{2}:2025' page.html | sort -u`
- Result: 10 ids, `LLM01:2025` to `LLM10:2025`.

Only the ids are kept. Titles and descriptions are OWASP's text and are not copied here;
read them on the page above. OWASP has published later editions that renumber this list,
so every ref carries its `:2025` suffix. A later edition belongs in a new registry file with
a new id, never as an edit to this one.
