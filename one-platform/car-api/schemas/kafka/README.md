# Kafka event contracts

- **Content type:** `application/json; charset=utf-8`
- **Envelope:** Every message is wrapped by the producer with `schemaVersion`, `eventType`, `id`, `timestamp`, and `payload` (see each JSON Schema).
- **Versioning:** Bump `schemaVersion` minor for additive fields; major for breaking renames/removals.

| Schema file | Topic (suggested) |
|-------------|-------------------|
| `pricing.quote.requested.v1.json` | `pricing.quote.requested` |
| `pricing.quote.completed.v1.json` | `pricing.quote.completed` |
| `pricing.calendar.updated.v1.json` | `pricing.calendar.updated` |

Example producer payload wrapper:

```json
{
  "schemaVersion": "1.0.0",
  "eventType": "pricing.quote.requested",
  "id": "evt_a1b2c3d4",
  "timestamp": "2026-03-28T12:00:00.000Z",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "payload": { }
}
```
