import multiprocessing
import os

# Gunicorn configuration tuned for 10,000+ users concurrency
bind = "0.0.0.0:" + os.getenv("PORT", "8000")
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 10000

# Timeout & Keepalive
timeout = 120
keepalive = 65

# Security & Request limits
max_requests = 10000
max_requests_jitter = 1000

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
