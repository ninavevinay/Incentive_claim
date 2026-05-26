# Portal Load Test (k6)

This folder contains a k6 test plan for high-volume validation before production rollout.

## 1) Prepare tokens for authenticated scenarios

1. Create `tokens.json` from the sample file:
   - `cp tokens.sample.json tokens.json`
2. Replace sample values with real JWT tokens from valid accounts.
3. Keep at least 50-200 tokens to avoid unrealistic cache behavior.

## 2) Run test

```bash
k6 run backend/loadtest/k6-portal.js \
  -e BASE_URL=http://127.0.0.1:8000 \
  -e TARGET_RPS=300 \
  -e PEAK_DURATION=10m \
  -e STEADY_DURATION=5m \
  -e COOL_DOWN_DURATION=3m \
  -e PREALLOCATED_VUS=600 \
  -e MAX_VUS=2500
```

## 3) Suggested readiness gates

- `http_req_failed < 1%`
- `p95 latency < 700ms`
- `p99 latency < 1200ms`
- No API worker crashes or DB connection exhaustion

## 4) For 100k registered-user readiness

Use this as a staged benchmark:

1. Warm-up: `TARGET_RPS=150` for 5-10 minutes
2. Peak: `TARGET_RPS=300` for 10-15 minutes
3. Stretch: `TARGET_RPS=450+` for 5-10 minutes

Increase only after previous stage passes all gates.
