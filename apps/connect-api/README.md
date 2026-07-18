# connect-api

Partner-facing REST API for surrendered-item bulk matching and recovery webhooks.

## Auth

All endpoints require the `x-api-key` header. Set `CONNECT_API_KEY` env var on the server.

```
x-api-key: your-secret-api-key
```

## Endpoints

### POST /surrendered-items/bulk-check

Match a batch of surrendered items against all active LOST reports.

**Request:**
```http
POST /surrendered-items/bulk-check
Content-Type: application/json
x-api-key: your-secret-api-key

{
  "items": [
    {
      "category": "electronics",
      "brand": "apple",
      "colour": "silver",
      "distinguishing": "scratched back, sticker on case",
      "phash": "a4b3c2d1e0f1a2b3",
      "locationHint": "Train station lost-and-found, London Paddington",
      "description": "iPhone found on seat 14C",
      "foundAt": "2026-07-18T10:00:00Z"
    }
  ]
}
```

**Response 200:**
```json
{
  "matches": [
    [
      {
        "foundReportId": "abc-123-def-456",
        "lostItemId": 42,
        "tokenId": "7",
        "ownerAddress": "0xOwnerAddress...",
        "phashSimilarity": 0.9375,
        "attributeOverlap": 1.0,
        "confidenceScore": 0.9625,
        "status": "Pending"
      }
    ]
  ]
}
```

**Response 400:** `{ "error": "items array required" }`  
**Response 401:** `{ "error": "Unauthorized" }`

---

### POST /webhook/recovery

Called **only** by the Section 1 indexer's confirmed-event stream after `CONFIRMATIONS_REQUIRED` blocks have passed and no reorg has been detected. Never call this from raw chain events.

**Request:**
```http
POST /webhook/recovery
Content-Type: application/json
x-api-key: your-secret-api-key

{
  "event": {
    "id": "evt_confirmed_abc123",
    "blockNumber": 1234567,
    "eventName": "Released",
    "data": {
      "tokenId": "7",
      "finder": "0xFinderAddress..."
    }
  }
}
```

**Response 200:**
```json
{
  "success": true
}
```

**Response 400:** `{ "error": "Invalid event payload" }`  
**Response 401:** `{ "error": "Unauthorized" }`

---

## Running Locally

```bash
CONNECT_API_KEY=dev-secret npm start
```

## Tests

```bash
npm test
```

6 integration tests covering auth, bulk-check, and webhook endpoint.

## OpenAPI Spec

See [`openapi.yaml`](./openapi.yaml) for the full spec.
