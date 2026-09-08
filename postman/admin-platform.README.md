# Admin platform Postman samples

Import both files, then select **AutoParts Admin Platform — Local** as the active environment:

- `admin-platform.postman_collection.json`
- `admin-platform.local.postman_environment.json`

The collection contains 26 requests with response assertions.

## Setup and run order

Ensure migration 040 is applied to the database used by your backend, then start it with `npm run dev`.

Set these environment variables:

| Variable | Value |
| --- | --- |
| `baseUrl` | `http://localhost:4000/api/v1`, or your deployed API prefix; no trailing slash |
| `adminEmail` | Your admin email; the supplied address is a sample |
| `adminPassword` | Your real admin password; the file leaves this blank |
| `adminToken`, `adminId` | Saved automatically by Login |
| `orderId` | An ID copied from List orders |
| `disputeId` | An ID copied from List disputes, for read-only detail |
| `workflowDisputeId` | An existing **open test dispute** for the action workflow |
| `partialAmountKobo` | A positive integer at most that dispute's order value; sample 1000 kobo = NGN 10 |
| `topSellersLimit` | 5 by default, maximum 20 |
| `sellerId`, `dateFrom`, `dateTo` | Optional dispute filters; query entries start disabled |

The admin account needs `dashboard.read`, `orders.manage`, `disputes.resolve`, and `audit_logs.read` for all folders.

1. Send **01 Login → Admin login**. The token and admin ID are saved to both the collection and active environment.
2. Run **02 Platform analytics**. It tests all four periods and CSV export. Empty datasets are valid; nonzero revenue needs delivered-and-paid orders created inside the selected window.
3. Send **03 Orders → List orders**, copy an ID into `orderId`, then send Order detail.
4. Send **04 Disputes → List open disputes**, copy an ID into `disputeId`, then send Dispute detail. Set the list's status to `all` to see resolved/closed records.
5. Set `workflowDisputeId` to an open test dispute and choose `partialAmountKobo` using its `order.orderValueKobo`. Run **05 Dispute workflow** in its numbered order.
6. Run **06 Validation samples**. The error statuses in the request names are expected; passing assertions mean the validation behaved correctly.

Use the response's test-results pane to inspect assertions. After filling the record IDs, a full collection run also works on a fresh open workflow dispute.

**The workflow changes the selected dispute**: open → in_review → escalated → resolved → closed. The initial response script halts the Collection Runner if the record is not open or the amount does not fit. When sending requests manually, stop if that check fails. Use a different open dispute on a second run.

No order/dispute is selected or created automatically. Existing application test records are needed for detail and action requests if your lists are empty. All protected requests inherit Bearer `{{adminToken}}`; Login and the deliberate missing-auth test use No Auth.

## Sample URLs

All POST bodies use Body → raw → JSON.

| Method | URL | Expected |
| --- | --- | --- |
| POST | `{{baseUrl}}/admin/login` | 200 |
| GET | `{{baseUrl}}/admin/analytics/platform?period=30d&topSellersLimit=5` | 200 |
| GET | `{{baseUrl}}/admin/analytics/platform/export?period=30d` | 200 CSV attachment |
| GET | `{{baseUrl}}/admin/orders?page=1&limit=10` | 200 |
| GET | `{{baseUrl}}/admin/orders/{{orderId}}` | 200 |
| GET | `{{baseUrl}}/admin/disputes/stats` | 200 |
| GET | `{{baseUrl}}/admin/disputes?status=open&page=1&limit=10` | 200 |
| GET | `{{baseUrl}}/admin/disputes/{{disputeId}}` | 200 |
| POST | `{{baseUrl}}/admin/disputes/{{workflowDisputeId}}/request-info` | 200; in_review |
| POST | `{{baseUrl}}/admin/disputes/{{workflowDisputeId}}/escalate` | 200; escalated |
| POST | `{{baseUrl}}/admin/disputes/{{workflowDisputeId}}/ruling` | 200; resolved |
| POST | `{{baseUrl}}/admin/disputes/{{workflowDisputeId}}/close` | 200; closed |
| GET | `{{baseUrl}}/admin/audit-logs?targetType=dispute&targetId={{workflowDisputeId}}&limit=50` | 200 |

To use the optional filters, set their variables and enable their query entries:

```text
{{baseUrl}}/admin/disputes?status=open&sellerId={{sellerId}}&dateFrom={{dateFrom}}&dateTo={{dateTo}}&page=1&limit=10
```

Dates are inclusive Africa/Lagos calendar dates in `YYYY-MM-DD` format. The orders list also includes disabled `status`, `paymentStatus` and `search` query examples.

## Sample JSON bodies

Login:

```json
{
  "email": "{{adminEmail}}",
  "password": "{{adminPassword}}"
}
```

Request information, from open:

```json
{
  "message": "Please provide photos of the damaged part and its packaging.",
  "requestedFrom": "both"
}
```

`requestedFrom` also accepts `buyer` and `seller`.

Escalate, from open or in_review:

```json
{
  "reason": "Buyer and seller evidence conflict; supervisor review is required."
}
```

Partial ruling, from open, in_review or escalated:

```json
{
  "notes": "Evidence confirms partial damage; record a partial refund for the buyer.",
  "decision": "partial_refund",
  "partialAmountKobo": 1000,
  "requireReverseLogistics": false
}
```

1000 is a sample amount; it must not exceed `order.orderValueKobo`. Notes require at least 10 characters. Rulings record a decision without calling Paystack or changing payment status. Setting `requireReverseLogistics: true` records only the flag.

Alternative ruling — use this **instead of** the partial ruling on an active dispute:

```json
{
  "notes": "The supplied evidence supports a full refund for the buyer.",
  "decision": "refund_buyer_full",
  "requireReverseLogistics": true
}
```

Other valid decisions are `refund_seller` and `no_action`. Omit `partialAmountKobo` for every non-partial decision. If you change the collection's partial-ruling body to an alternative, also update/remove its assertions that specifically expect `partial_refund` and `requireReverseLogistics: false`.

Close, from resolved or escalated:

```json
{
  "reason": "The ruling has been recorded and administrative review is complete."
}
```

## Expected errors and assertions

The collection verifies analytics summary/series reconciliation, integer amounts, average calculation, continuous date buckets, category percentages, seller totals, response shapes, workflow timeline actors and all four audit events.

Error samples:

- Missing token: 401.
- `period=2d`, `topSellersLimit=21`, or `dateFrom=2026-02-30`: 422 / `VALIDATION_ERROR`.
- Partial ruling without `partialAmountKobo`: 422 / `VALIDATION_ERROR`. This sample uses numeric placeholder ID 1 because body validation runs before record lookup.
- Closing an open dispute, repeating request-info from in_review, or ruling on a closed dispute: 409 / `CONFLICT`.

A valid token without the needed permission returns 403. An unknown detail ID returns 404.

Success responses use `{ success: true, data, message }`. Errors use `{ success: false, error: { code, message } }`. CSV uses a file response; save it with a `.csv` extension.

The JSON files and request scripts were checked locally. No requests were sent to your running application or used to change your database.

