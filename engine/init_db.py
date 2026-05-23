#!/usr/bin/env python3
"""
Run database migrations using Alembic to initialize or upgrade engine tables.

Run inside the engine container (WORKDIR /app):

    python init_db.py

Requires: DATABASE_URL set in the environment (engine/.env.docker or shell).
`subjects` must already exist because documents.subject_id FK references it.
"""
import os
import sys
from alembic.config import Config
from alembic import command


def main() -> None:
    print("[init_db] Bootstrapping database using Alembic...")
    
    # Resolve the path to alembic.ini relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ini_path = os.path.join(script_dir, "alembic.ini")
    
    if not os.path.exists(ini_path):
        print(f"[init_db] Error: alembic.ini not found at {ini_path}", file=sys.stderr)
        sys.exit(1)
        
    alembic_cfg = Config(ini_path)
    
    try:
        # Run 'alembic upgrade head'
        command.upgrade(alembic_cfg, "head")
        print("[init_db] OK: Alembic database migrations applied successfully.")
    except Exception as e:
        print(f"[init_db] Error applying migrations: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

