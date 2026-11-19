# State Street CDO – Data Readiness

A static dashboard with simulated records for the July 10, 2026 wireframe snapshot. All dashboard values come from the sample records.

## Run and host

Unzip the package and open `index.html` in a browser. Keep the files together. There are no dependencies, external requests, or build steps.

For an HTTP preview, run `python3 -m http.server 8000 --bind 127.0.0.1` from the dashboard folder and open [the local dashboard](http://127.0.0.1:8000/). For GitHub Pages or another static host, publish the contents of this folder as the site root.

## Investigate

Choose any combination of record type, record ID, exception class, and source system, then select **Apply filters**. The ID search is case-insensitive and matches substrings. Select a breakdown bar to toggle its exception class within the applied scope. Select a record ID to review its exception details or select a date to see its eligible, adherent, and nonadherent counts. **Reset** clears all filters. KPI cards and platform-wide timestamp totals stay fixed.

The daily trend uses pipeline events and their linked records. A record-type or ID filter can match an event or its linked record. A source filter on the trend uses the event's source; the table uses the source of the exception occurrence. An exception-class filter scopes the trend to events with a matching exception on the event or its linked record. Dates without eligible events display a dash.

## Change rules and data

- `config.js` holds metric definitions, required quantity and cutoff fields, owner assignments, severity mapping, and breakdown groups. Position operations is a provisional assignment for position quantity exceptions. The supplied transaction quantity assignment is Trade capture.
- `data.js` supplies the snapshot and records. Preserve `type`, `id`, and `source` on each row. For valuation, supply `requiresValuation`, `securityId`, `date` and `currency`, and include price records with the same key and a usable price. Pipeline rows use `relatedType` and `relatedId` to link to a record. Supply event timestamps as ISO 8601 strings with explicit offsets.
- `metrics.js` performs the joins, exception detection, KPI aggregation, and trend scoping. Missing quantities and prices count each record type and ID once per exception class. Unresolved master references count once per record and reference type for the KPI, and once per affected record in the combined breakdown bar. Missing or invalid receipt times are reported separately and do not affect cutoff adherence. Missing or invalid booking and publication times make eligible events nonadherent. A cutoff violation row identifies a known late timestamp, while missing timestamps have their own exception class.
- `index.html`, `styles.css`, and `dashboard.js` define the interface. The header wordmark is taken from the supplied wireframe.
