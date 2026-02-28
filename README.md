# VoltLog

#### Structured logger for real-time infrastructure — zero dependencies, type-safe, OCPP-aware

[![npm version](https://img.shields.io/npm/v/voltlog-io?color=blue)](https://www.npmjs.com/package/voltlog-io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/voltlog-io)

**VoltLog** is a modern, lightweight, and type-safe structured logger designed for high-throughput, real-time systems like IoT platforms, WebSocket servers (OCPP), and microservices.

## 📚 Full Documentation

For detailed guides, API reference, and advanced usage:

### [👉 https://ocpp-ws-io.rohittiwari.me/docs/voltlog-io](https://ocpp-ws-io.rohittiwari.me/docs/voltlog-io)

## 📦 Installation

```bash
npm install voltlog-io
```

## 🚀 Quick Start

```ts
import { createLogger, prettyTransport, consoleTransport } from "voltlog-io";

// Development — pretty colored output
const logger = createLogger({
  level: "DEBUG",
  transports: [prettyTransport()],
});

// Production — structured JSON
const logger = createLogger({
  level: "INFO",
  transports: [consoleTransport()],
});

logger.info("Server started", { port: 3000, env: "production" });
logger.error("Connection failed", new Error("ETIMEDOUT"));
```

## 📖 Features

### Core Logging

```ts
// All log levels
logger.trace("Entering function");
logger.debug("Parsed payload", { bytes: 1024 });
logger.info("User authenticated", { userId: "u-42" });
logger.warn("Rate limit approaching", { rate: 95 });
logger.error("Query failed", { query: "SELECT *" }, new Error("timeout"));
logger.fatal("Unrecoverable", new Error("OOM"));

// Runtime level control
logger.setLevel("WARN"); // change at runtime
logger.getLevel(); // → "WARN"
logger.isLevelEnabled("DEBUG"); // → false (useful to guard expensive computation)

// Timer helper — auto-logs duration
const timer = logger.startTimer();
await doExpensiveWork();
timer.done("Work completed", { items: 100 });
// → INFO Work completed { durationMs: 342, items: 100 }
```

### Child Loggers

```ts
const cpLogger = logger.child({ chargePointId: "CP-101" });
cpLogger.info("Connected");
// → context: { chargePointId: "CP-101" }

const sessionLogger = cpLogger.child({ sessionId: "sess-xyz" });
sessionLogger.info("Charging started");
// → context: { chargePointId: "CP-101", sessionId: "sess-xyz" }
```

### Error Cause Chain (ES2022)

```ts
const rootCause = new Error("ECONNREFUSED 10.0.0.5:5432");
const dbError = new Error("DB connection failed", { cause: rootCause });
const appError = new Error("Request failed", { cause: dbError });

logger.error("Handler crashed", appError);
// → error.cause.cause.message = "ECONNREFUSED 10.0.0.5:5432" ← root cause preserved!
```

### Custom ID Generator

```ts
// Default: crypto.randomUUID() (fast, native)
const logger = createLogger({ transports: [...] });

// Custom generator
const logger = createLogger({
  idGenerator: () => `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  transports: [...],
});

// Disable for max performance
const logger = createLogger({ idGenerator: false, transports: [...] });
```

---

## 🔌 Transports (14 Built-in)

### Console & Pretty

```ts
import { consoleTransport, prettyTransport } from "voltlog-io";

consoleTransport(); // JSON to stdout
prettyTransport({ colors: true, timestamps: true }); // colored dev output
```

### File (Daily + Size Rotation)

```ts
import { fileTransport } from "voltlog-io";

fileTransport({
  dir: "./logs",
  filename: "app-%DATE%.log", // daily rotation
  maxSize: 10_000_000, // 10MB size rotation
});
// → logs/app-2026-02-28.log → logs/app-2026-02-28.1.log (at 10MB)
```

### Ring Buffer (In-Memory Diagnostics)

```ts
import { ringBufferTransport } from "voltlog-io";

const ring = ringBufferTransport({ maxSize: 500 });

// Query buffered logs
ring.getEntries({ level: "ERROR" });
ring.getEntries({ since: Date.now() - 300_000, limit: 20 });
ring.clear();
```

### Webhook (with Batching & Retry)

```ts
import { webhookTransport, batchTransport } from "voltlog-io";

batchTransport(
  webhookTransport({
    url: "https://api.example.com/logs",
    headers: { Authorization: "Bearer token" },
    retry: true,
    maxRetries: 3,
  }),
  { batchSize: 50, flushIntervalMs: 5000 },
);
```

### OpenTelemetry (SigNoz, Jaeger, Grafana)

```ts
import { otelTransport, otelTraceMiddleware } from "voltlog-io";

const logger = createLogger({
  middleware: [otelTraceMiddleware()], // auto-picks traceId/spanId
  transports: [
    otelTransport({
      endpoint: "https://ingest.signoz.io",
      headers: { "signoz-access-token": "YOUR_TOKEN" },
      serviceName: "my-app",
      resource: { "deployment.environment": "production" },
    }),
  ],
});
// Every log auto-includes traceId + spanId from active OTel spans
```

### Loki (Grafana)

```ts
import { lokiTransport } from "voltlog-io";

lokiTransport({
  host: "http://loki:3100",
  labels: { app: "my-service", env: "prod" },
  dynamicLabels: (entry) => ({ level: entry.levelName }),
  includeMetadata: true, // context, error, correlationId
  retry: true,
  maxRetries: 3,
});
```

### Other Transports

```ts
import {
  datadogTransport, // Datadog Logs API
  sentryTransport, // Sentry (errors + breadcrumbs)
  slackTransport, // Slack webhook
  discordTransport, // Discord webhook
  redisTransport, // Redis Streams
  jsonStreamTransport, // Node.js WritableStream
  browserJsonStreamTransport, // Browser WritableStream
} from "voltlog-io";
```

---

## 🧩 Middleware (13 Built-in)

### Redaction

```ts
import { redactionMiddleware } from "voltlog-io";

redactionMiddleware({
  paths: ["password", "idToken", "authorization"],
  deep: true, // search nested objects
  replacement: "[REDACTED]",
});
```

### AsyncLocalStorage Context

```ts
import { asyncContextMiddleware } from "voltlog-io";

const asyncCtx = asyncContextMiddleware();

const logger = createLogger({
  middleware: [asyncCtx.middleware],
  transports: [prettyTransport()],
});

// Set context once — propagates across all async boundaries
app.use((req, res, next) => {
  asyncCtx.runInContext({ requestId: req.id, userId: req.user?.id }, next);
});

// Anywhere downstream — no child() needed
logger.info("Processing order");
// → auto-includes { requestId, userId }
```

### Sampling & Rate Limiting

```ts
import { samplingMiddleware } from "voltlog-io";

samplingMiddleware({
  maxPerWindow: 10, // max 10 logs per window
  windowMs: 60_000, // per minute
  priorityLevel: 40, // WARN+ always passes
});
```

### Other Middleware

```ts
import {
  correlationIdMiddleware, // auto-generate/propagate correlation IDs
  alertMiddleware, // trigger alerts on error spikes
  deduplicationMiddleware, // suppress repeated logs
  heapUsageMiddleware, // attach memory stats
  ipMiddleware, // extract client IP
  userAgentMiddleware, // extract User-Agent
  levelOverrideMiddleware, // dynamic level via headers
  ocppMiddleware, // OCPP protocol enrichment
  otelTraceMiddleware, // OpenTelemetry trace context
  createHttpLogger, // HTTP request/response logging
} from "voltlog-io";
```

---

## ⚡ Performance

```ts
// Max performance mode — zero overhead for filtered logs
const logger = createLogger({
  level: "WARN",
  idGenerator: false, // no ID generation
  transports: [consoleTransport()],
});

// These cost ~0.02μs each (100x faster than Pino for filtered logs)
logger.trace("free");
logger.debug("free");
logger.info("free");

// Only these execute
logger.warn("logged");
logger.error("logged");
```

## 🛡️ Graceful Shutdown

```ts
process.on("SIGTERM", async () => {
  await logger.flush(); // ensure all buffered logs are sent
  await logger.close(); // release resources (file handles, connections)
  process.exit(0);
});
```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](LICENSE) © [Rohit Tiwari](https://github.com/rohittiwari-dev)
