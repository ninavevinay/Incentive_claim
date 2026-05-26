import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const TARGET_RPS = Number(__ENV.TARGET_RPS || 300);
const PEAK_DURATION = __ENV.PEAK_DURATION || "10m";
const STEADY_DURATION = __ENV.STEADY_DURATION || "5m";
const COOL_DOWN_DURATION = __ENV.COOL_DOWN_DURATION || "3m";
const MAX_VUS = Number(__ENV.MAX_VUS || 2500);
const PREALLOCATED_VUS = Number(__ENV.PREALLOCATED_VUS || 600);

let TOKENS = [];
try {
  TOKENS = JSON.parse(open("./tokens.json"));
} catch (error) {
  TOKENS = [];
}

function randomToken() {
  if (!Array.isArray(TOKENS) || TOKENS.length === 0) return "";
  const index = Math.floor(Math.random() * TOKENS.length);
  return String(TOKENS[index] || "");
}

export const options = {
  discardResponseBodies: true,
  scenarios: {
    public_reads: {
      executor: "ramping-arrival-rate",
      exec: "publicReads",
      startRate: Math.max(1, Math.floor(TARGET_RPS * 0.1)),
      timeUnit: "1s",
      preAllocatedVUs: PREALLOCATED_VUS,
      maxVUs: MAX_VUS,
      stages: [
        { target: Math.max(5, Math.floor(TARGET_RPS * 0.3)), duration: "2m" },
        { target: TARGET_RPS, duration: PEAK_DURATION },
        { target: Math.max(20, Math.floor(TARGET_RPS * 0.6)), duration: STEADY_DURATION },
        { target: 0, duration: COOL_DOWN_DURATION },
      ],
    },
    authorized_reads: {
      executor: "ramping-arrival-rate",
      exec: "authorizedReads",
      startRate: Math.max(1, Math.floor(TARGET_RPS * 0.05)),
      timeUnit: "1s",
      preAllocatedVUs: PREALLOCATED_VUS,
      maxVUs: MAX_VUS,
      stages: [
        { target: Math.max(3, Math.floor(TARGET_RPS * 0.2)), duration: "2m" },
        { target: Math.max(10, Math.floor(TARGET_RPS * 0.6)), duration: PEAK_DURATION },
        { target: Math.max(5, Math.floor(TARGET_RPS * 0.35)), duration: STEADY_DURATION },
        { target: 0, duration: COOL_DOWN_DURATION },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<700", "p(99)<1200"],
  },
};

export function publicReads() {
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health status 200": (r) => r.status === 200,
  });

  const noticesRes = http.get(`${BASE_URL}/notices/public`);
  check(noticesRes, {
    "notices status 200": (r) => r.status === 200,
  });
  sleep(Math.random() * 0.5);
}

export function authorizedReads() {
  const token = randomToken();
  if (!token) {
    publicReads();
    return;
  }

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const meRes = http.get(`${BASE_URL}/profile/me`, params);
  check(meRes, {
    "profile status 200": (r) => r.status === 200,
  });

  const mineRes = http.get(`${BASE_URL}/applications/mine?limit=60`, params);
  check(mineRes, {
    "my applications status 200": (r) => r.status === 200,
  });
  sleep(Math.random() * 0.7);
}
