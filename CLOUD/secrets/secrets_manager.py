"""
AEGENTIS CORPORATION - Secrets Manager
Centralized secrets management for all divisions.
Reads from environment variables, AWS SSM, or local vault.
"""

import os
import json
from pathlib import Path

VAULT_PATH = Path(os.getenv("AEGENTIS_VAULT_PATH", "/run/secrets/aegentis"))


class SecretsManager:
    def __init__(self):
        self._cache = {}

    def get(self, key, default=None):
        """Retrieve a secret. Priority: env > vault file > default."""
        if key in self._cache:
            return self._cache[key]

        # 1. Environment variable
        val = os.getenv(key)
        if val:
            self._cache[key] = val
            return val

        # 2. Vault file
        vault_file = VAULT_PATH / key
        if vault_file.exists():
            val = vault_file.read_text().strip()
            self._cache[key] = val
            return val

        return default

    def require(self, key):
        val = self.get(key)
        if val is None:
            raise EnvironmentError(f"[SECRETS] Required secret not found: {key}")
        return val

    def list_keys(self):
        keys = list(os.environ.keys())
        if VAULT_PATH.exists():
            keys += [f.name for f in VAULT_PATH.iterdir() if f.is_file()]
        return sorted(set(keys))


secrets = SecretsManager()
