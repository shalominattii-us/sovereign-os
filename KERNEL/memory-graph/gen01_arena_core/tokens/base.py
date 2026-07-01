from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional
import uuid

@dataclass
class TokenMetadata:
    token_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    version: str = "GEN-01"
    signature: Optional[str] = None

class AegenticToken(ABC):
    def __init__(self, name: str, token_type: str):
        self.name = name
        self.token_type = token_type
        self.metadata = TokenMetadata()
        self.state: Dict[str, Any] = {}

    @abstractmethod
    def bind_to_arena(self, arena_id: str):
        pass

    @abstractmethod
    def validate(self) -> bool:
        pass

    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.token_type,
            "id": self.metadata.token_id,
            "version": self.metadata.version,
            "state": self.state
        }
