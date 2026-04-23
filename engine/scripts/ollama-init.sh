#!/bin/sh
set -eu

OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
export OLLAMA_HOST

GENERATION_MODEL="${OLLAMA_GENERATION_MODEL:-qwen2.5:3b}"
EMBEDDING_MODEL="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"
REQUIRED_MODELS="${REQUIRED_MODELS:-$GENERATION_MODEL $EMBEDDING_MODEL}"

wait_for_ollama() {
  echo "[ollama-init] Waiting for Ollama API..."
  i=0
  until ollama list >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
      echo "[ollama-init] Ollama did not become ready in time."
      exit 1
    fi
    sleep 2
  done
  echo "[ollama-init] Ollama API is ready."
}

has_model() {
  model="$1"
  ollama list | awk '{print $1}' | grep -Fxq "$model"
}

ensure_model() {
  model="$1"
  if has_model "$model"; then
    echo "[ollama-init] Model already present: $model"
  else
    echo "[ollama-init] Pulling missing model: $model"
    ollama pull "$model"
  fi
}

wait_for_ollama

SEEN_MODELS=""
for model in $REQUIRED_MODELS; do
  [ -n "$model" ] || continue
  case " $SEEN_MODELS " in
    *" $model "*)
      continue
      ;;
  esac
  SEEN_MODELS="$SEEN_MODELS $model"
  ensure_model "$model"
done

echo "[ollama-init] Model initialization complete."
