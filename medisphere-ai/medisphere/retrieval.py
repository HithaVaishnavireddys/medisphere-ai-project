"""Days 7-9 - embeddings, vector store and hybrid retrieval.

* Keyword side : BM25 implemented from scratch (numpy).
* Semantic side: TF-IDF (1-2 grams) + Truncated-SVD "LSA" embeddings stored in a
  small in-memory vector store and searched by cosine similarity.
  (Swap `Embedder` for sentence-transformers / an embeddings API in production.)
* Hybrid       : weighted fusion + medical synonym query expansion + lightweight re-rank.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from .config import load_json, rules
from .textutil import sentences, tokens


@dataclass
class Chunk:
    id: str
    doc_id: str
    title: str
    category: str
    source: str
    text: str
    toks: list[str] = field(default_factory=list)


def chunk_document(doc_id: str, title: str, text: str, category="Uploaded document",
                   source="Uploaded", max_words=90) -> list[Chunk]:
    """Sentence-aware chunking with a ~max_words window (Day 8/9 ingestion)."""
    sents = sentences(re.sub(r"\s+", " ", text))
    chunks, cur, n = [], [], 0
    for s in sents or [text]:
        w = len(s.split())
        if cur and n + w > max_words:
            chunks.append(" ".join(cur)); cur, n = [], 0
        cur.append(s); n += w
    if cur:
        chunks.append(" ".join(cur))
    return [Chunk(f"{doc_id}#{i+1}", doc_id, title, category, source, c) for i, c in enumerate(chunks)]


class HybridRetriever:
    def __init__(self, docs: list[dict] | None = None):
        docs = docs if docs is not None else load_json("knowledge_base.json")
        self.chunks: list[Chunk] = []
        for d in docs:
            self.chunks.append(Chunk(d["id"], d["id"], d["title"], d["category"], d["source"], d["text"]))
        self._fit()

    # ------------------------------------------------------------------ indexing
    def add_document(self, doc_id: str, title: str, text: str, category="Uploaded document", source="Uploaded") -> int:
        new = chunk_document(doc_id, title, text, category, source)
        self.chunks.extend(new)
        self._fit()
        return len(new)

    def _index_text(self, c: Chunk) -> str:
        return f"{c.title}. {c.title}. {c.text}"

    def _fit(self):
        for c in self.chunks:
            c.toks = tokens(self._index_text(c))
        self.N = len(self.chunks)
        self.avgdl = sum(len(c.toks) for c in self.chunks) / max(self.N, 1)
        df: dict[str, int] = {}
        for c in self.chunks:
            for t in set(c.toks):
                df[t] = df.get(t, 0) + 1
        self.df = df
        self.idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()}
        self.tf = [self._counts(c.toks) for c in self.chunks]
        # Dense embeddings (vector store)
        corpus = [" ".join(c.toks) for c in self.chunks]
        self.vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, token_pattern=r"\S+", lowercase=False)
        X = self.vec.fit_transform(corpus)
        self.X = X
        k = max(2, min(48, X.shape[0] - 1, X.shape[1] - 1))
        self.svd = TruncatedSVD(n_components=k, random_state=7)
        E = self.svd.fit_transform(X)
        norms = np.linalg.norm(E, axis=1, keepdims=True)
        self.E = E / np.where(norms == 0, 1, norms)  # the vector store: one row per chunk

    @staticmethod
    def _counts(toks):
        d: dict[str, int] = {}
        for t in toks:
            d[t] = d.get(t, 0) + 1
        return d

    # ------------------------------------------------------------------ query side
    def expand(self, query: str) -> tuple[list[str], list[str]]:
        """Return (original tokens, expansion tokens) using the medical synonym map."""
        q = query.lower()
        base = tokens(query)
        extra: list[str] = []
        for key, vals in rules()["synonyms"].items():
            if re.search(r"\b" + re.escape(key) + r"\b", q):
                for v in vals:
                    extra += tokens(v)
        extra = [t for t in dict.fromkeys(extra) if t not in base]
        return base, extra

    def _bm25(self, qtoks_w: dict[str, float]) -> np.ndarray:
        k1, b = 1.5, 0.75
        scores = np.zeros(self.N)
        for i, c in enumerate(self.chunks):
            dl = len(c.toks)
            s = 0.0
            for t, w in qtoks_w.items():
                f = self.tf[i].get(t, 0)
                if f:
                    s += w * self.idf.get(t, 0) * f * (k1 + 1) / (f + k1 * (1 - b + b * dl / self.avgdl))
            scores[i] = s
        return scores

    def _dense(self, query_text: str) -> np.ndarray:
        q = " ".join(tokens(query_text))
        qx = self.vec.transform([q])
        tfidf_cos = (self.X @ qx.T).toarray().ravel()  # rows are L2-normalised
        qe = self.svd.transform(qx)
        n = np.linalg.norm(qe)
        lsa_cos = (self.E @ (qe / (n if n else 1)).ravel())
        return np.clip(0.5 * tfidf_cos + 0.5 * np.clip(lsa_cos, 0, 1), 0, 1)

    def search(self, query: str, k: int = 5, mode: str = "hybrid") -> list[dict]:
        base, extra = self.expand(query)
        if not base and not extra:
            return []
        weights = {t: 1.0 for t in base}
        for t in extra:
            weights.setdefault(t, 0.5)
        bm = self._bm25(weights)
        bm_sat = 1 - np.exp(-bm / 8.0)
        dense = self._dense(query + " " + " ".join(extra))
        unk = math.log(1 + (self.N + 0.5) / 0.5)  # unseen words are maximally informative
        denom = max(sum(self.idf.get(t, unk) for t in set(base)), 1e-9)
        cover = np.array([sum(self.idf.get(t, unk) for t in set(base) if t in self.tf[i]) / denom
                          for i in range(self.N)])
        if mode == "keyword":
            final = bm_sat
        elif mode == "semantic":
            final = dense
        else:
            final = 0.5 * bm_sat + 0.3 * dense + 0.2 * cover
            # light re-rank: query terms appearing in the title
            for i, c in enumerate(self.chunks):
                tt = set(tokens(c.title))
                final[i] += 0.05 * (len(tt & set(base)) > 0)
        order = np.argsort(-final)[:k]
        out = []
        qset = set(base) | set(extra)
        for i in order:
            if final[i] <= 0:
                continue
            c = self.chunks[i]
            out.append({
                "id": c.id, "doc_id": c.doc_id, "title": c.title, "category": c.category, "source": c.source,
                "score": round(float(min(final[i], 1.0)), 3),
                "bm25": round(float(bm_sat[i]), 3), "semantic": round(float(dense[i]), 3), "coverage": round(float(cover[i]), 3),
                "text": c.text, "snippet": best_snippet(c.text, qset),
            })
        return out


def best_snippet(text: str, qset: set[str], n: int = 2) -> str:
    sents = sentences(text)
    scored = sorted(
        ((sum(1 for t in tokens(s) if t in qset), -i, s) for i, s in enumerate(sents)), reverse=True)
    pick = sorted(scored[:n], key=lambda x: -x[1])
    return " ".join(s for _, _, s in pick)
