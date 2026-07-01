"""
AEGENTIS CORPORATION - Knowledge Graph
Sovereign knowledge graph connecting entities, events, and relationships
across all AEGENTIS divisions. Enables cross-domain reasoning.
"""

import uuid
from datetime import datetime
from collections import defaultdict


class KnowledgeGraph:
    def __init__(self):
        self.nodes = {}       # node_id -> node
        self.edges = defaultdict(list)  # node_id -> [edges]
        self.labels = defaultdict(set)  # label -> {node_ids}

    def add_node(self, label: str, properties: dict = None) -> dict:
        node_id = str(uuid.uuid4())
        node = {
            "node_id": node_id,
            "label": label,
            "properties": properties or {},
            "created_at": datetime.utcnow().isoformat()
        }
        self.nodes[node_id] = node
        self.labels[label].add(node_id)
        return node

    def add_edge(self, from_id: str, relation: str, to_id: str, properties: dict = None) -> dict:
        edge = {
            "edge_id": str(uuid.uuid4()),
            "from": from_id,
            "relation": relation,
            "to": to_id,
            "properties": properties or {},
            "created_at": datetime.utcnow().isoformat()
        }
        self.edges[from_id].append(edge)
        return edge

    def get_node(self, node_id: str) -> dict:
        return self.nodes.get(node_id)

    def find_by_label(self, label: str) -> list:
        return [self.nodes[nid] for nid in self.labels.get(label, set())]

    def get_neighbors(self, node_id: str, relation: str = None) -> list:
        edges = self.edges.get(node_id, [])
        if relation:
            edges = [e for e in edges if e["relation"] == relation]
        return [{"edge": e, "node": self.nodes.get(e["to"])} for e in edges]

    def traverse(self, start_id: str, max_depth: int = 3) -> dict:
        """BFS traversal from a node up to max_depth."""
        visited = set()
        result = {"nodes": [], "edges": []}
        queue = [(start_id, 0)]
        while queue:
            node_id, depth = queue.pop(0)
            if node_id in visited or depth > max_depth:
                continue
            visited.add(node_id)
            if node_id in self.nodes:
                result["nodes"].append(self.nodes[node_id])
            for edge in self.edges.get(node_id, []):
                result["edges"].append(edge)
                queue.append((edge["to"], depth + 1))
        return result

    def stats(self) -> dict:
        return {
            "total_nodes": len(self.nodes),
            "total_edges": sum(len(v) for v in self.edges.values()),
            "labels": {k: len(v) for k, v in self.labels.items()}
        }


# Singleton
knowledge_graph = KnowledgeGraph()

# Bootstrap: register core AEGENTIS entities
_aegentis = knowledge_graph.add_node("Corporation", {"name": "AEGENTIX CYBERNETICS"})
for division in ["KERNEL", "TREASURY", "FINANCE", "AI", "XR", "CLOUD", "DATA", "SECURITY", "DEVELOPER", "ECOSYSTEM"]:
    _div = knowledge_graph.add_node("Division", {"name": f"AEGENTIS {division}"})
    knowledge_graph.add_edge(_aegentis["node_id"], "HAS_DIVISION", _div["node_id"])
