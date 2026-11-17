# owasp-asi-2026: where the ids came from

- Page: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- Document: the PDF that page links, https://genai.owasp.org/download/52117/ ("Version 2026",
  "December 2025" on its cover).
- Retrieved: 2026-11-17, over verified TLS with a generic User-Agent.
- Bytes fetched (PDF): SHA-256 `a2db94cd00b08e0b3a5e5b619afe024bdbcd74503111085705e4f3dd886fcb5c`
- Extraction: `pdftotext -layout top10.pdf - | grep -oE 'ASI ?[0-9]{2}' | tr -d ' ' | sort -u`
- Result: 10 ids, `ASI01` to `ASI10`.

Only the ids are kept. Titles are OWASP's text and are not copied here; read them in the PDF.
