#!/usr/bin/env python3
"""Give the isolated GitHub Actions Supabase stack non-default, available host ports.

Never stop a service that owns a conflicting port: configure our own stack instead.
This runs after "supabase init" and before "supabase start".
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import socket
import tomllib

config_path = Path(os.environ.get("SUPABASE_CONFIG_PATH", "supabase/config.toml"))
source = config_path.read_text(encoding="utf-8")
config = tomllib.loads(source)
for section, key in (("api", "port"), ("db", "port"), ("db", "shadow_port")):
    if not isinstance(config.get(section, {}).get(key), int):
        raise SystemExit(f"Supabase config is missing [{section}] {key}")

chosen: set[int] = set()


def free_port() -> int:
    for _ in range(20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("0.0.0.0", 0))
            port = probe.getsockname()[1]
        if port not in chosen and port not in (54320, 54321, 54322):
            chosen.add(port)
            return port
    raise SystemExit("Could not allocate distinct host ports for local Supabase")


def set_port(text: str, section: str, key: str, port: int) -> str:
    heading = re.search(rf"(?m)^\[{re.escape(section)}\][ \t]*$", text)
    if heading is None:
        raise SystemExit(f"Missing Supabase [{section}] section")
    start = heading.end()
    following = re.search(r"(?m)^\[[^\n]+\][ \t]*$", text[start:])
    end = start + following.start() if following else len(text)
    body = text[start:end]
    pattern = rf"(?m)^({re.escape(key)}[ \t]*=[ \t]*)\d+([ \t]*(?:#.*)?)$"
    changed, count = re.subn(pattern, lambda match: match.group(1) + str(port) + match.group(2), body, count=1)
    if count != 1:
        raise SystemExit(f"Could not update [{section}] {key}")
    return text[:start] + changed + text[end:]


ports: dict[str, int] = {}
for section, key in (("api", "port"), ("db", "port"), ("db", "shadow_port")):
    port = free_port()
    ports[f"{section}.{key}"] = port
    source = set_port(source, section, key, port)

verified = tomllib.loads(source)
for field, port in ports.items():
    section, key = field.split(".")
    if verified[section][key] != port:
        raise SystemExit(f"Invalid remapped port: {field}")

config_path.write_text(source, encoding="utf-8")
db_url = f"postgresql://postgres:postgres@127.0.0.1:{ports['db.port']}/postgres"
if env_file := os.environ.get("GITHUB_ENV"):
    with open(env_file, "a", encoding="utf-8") as handle:
        handle.write(f"CI_SUPABASE_DB_URL={db_url}\n")
print(f"Isolated Supabase ports: API={ports['api.port']}, DB={ports['db.port']}, shadow={ports['db.shadow_port']}")
