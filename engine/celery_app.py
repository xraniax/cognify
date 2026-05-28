import os
from celery import Celery

broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

celery_app = Celery(
    "cognify_engine",
    broker=broker_url,
    backend=result_backend,
    include=["tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    # Allow multiple tasks to run concurrently so one long LLM call (60–180 s)
    # does not block every other user's queued task.  Ollama serialises GPU
    # requests internally, so workers do not fight for the GPU — they simply
    # queue independently at the Ollama level.  Default 4 is intentionally
    # conservative; raise CELERY_WORKER_CONCURRENCY in production as needed.
    worker_concurrency=int(os.getenv("CELERY_WORKER_CONCURRENCY", "4")),
    # Prefetch=1 keeps task distribution fair: each worker takes exactly one
    # task at a time, preventing a fast worker from hoarding the queue.
    worker_prefetch_multiplier=1,
    # Late ack: task is acknowledged only after it finishes, so a worker crash
    # requeues the task rather than silently dropping it.
    task_acks_late=True,
)
