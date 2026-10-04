"""Days 8-9 - Retrieval-Augmented Generation with guardrails, memory and citations."""
from __future__ import annotations

import re
import time

from . import guardrails, llm, prompts
from .config import HOSPITAL_NAME, load_json, rules
from .memory import SessionMemory, drugs_in
from .retrieval import HybridRetriever
from .textutil import sentences, tokens
from .triage import detect_symptoms

_FRIENDLY_ABSTAIN = ("I could not find reliable information about that in the hospital knowledge base, so I will not guess. "
                     "Try rephrasing, or ask a clinician / pharmacist.")


def extractive_answer(question: str, results: list[dict], retriever: HybridRetriever) -> str:
    base, extra = retriever.expand(question)
    q = set(base) | set(extra)
    lines = []
    for n, r in enumerate(results[:3], 1):
        sents = sentences(r["text"])
        scored = sorted(((sum(1 for t in tokens(s) if t in q), -i, s) for i, s in enumerate(sents)), reverse=True)
        keep = [s for sc, _, s in sorted(scored[:2], key=lambda x: -x[1]) if sc > 0] or sents[:1]
        lines.append(f"- {' '.join(keep)} [{n}]")
    return "\n".join(lines)


class Assistant:
    def __init__(self, retriever: HybridRetriever | None = None):
        self.retriever = retriever or HybridRetriever()
        self.memory = SessionMemory()

    def ask(self, question: str, session_id: str = "default", provider: str | None = None, mode: str = "hybrid", emergency: str | None = None) -> dict:
        t0 = time.time()
        rep = guardrails.check_input(question)
        flags = rep["flags"]
        clean = rep["clean_text"]
        # injection: strip the offending clause, answer the medical remainder (or abstain)
        q = re.sub("|".join(rules()["guard"]["injection"]), " ", clean, flags=re.I) if flags["injection"] else clean
        urgent = any(h["red_flag"] and h["level_floor"] <= 2 for h in detect_symptoms(clean)) and not flags["self_harm"]
        if self.memory.is_followup(session_id, q):  # "and the warning signs?" inherits the previous topic
            q = self.memory.contextualise(session_id, q)
        self.memory.remember(session_id, "user", question if not rep["pii"] else clean)
        results = self.retriever.search(q, k=4, mode=mode)
        grounded = guardrails.is_grounded(results)
        if flags["self_harm"]:
            results = self.retriever.search("suicidal thoughts mental health crisis", k=2)
            grounded = True
        sources = [r for r in results if r["score"] >= max(0.30, results[0]["score"] * 0.6)] if grounded and results else []
        profile = self.memory.context(session_id)
        if grounded:
            ctx = "\n".join(f"[{i}] {r['title']}: {r['text']}" for i, r in enumerate(sources[:3], 1))
            sys_p = prompts.RAG_SYSTEM.format(hospital=HOSPITAL_NAME, patient=profile or "none")
            usr = prompts.RAG_USER.format(context=ctx, question=q)
            out = llm.complete(sys_p, usr, provider, offline_fn=lambda: extractive_answer(q, sources, self.retriever))
            body = out["text"] if not flags["self_harm"] else sources[0]["text"]
        else:
            out = {"provider": "guardrail:abstain", "latency_ms": 0, "fallback": False}
            body = _FRIENDLY_ABSTAIN
        # drug interaction side-check for mentioned medicines
        extra = []
        ds = drugs_in(clean)
        if len(ds) >= 2:
            from .tools import check_drug_interactions
            di = check_drug_interactions(ds)
            for p in di["interactions"]:
                extra.append(f"Interaction ({p['severity']}): {p['a']} + {p['b']} - {p['effect']} {p['advice']}")
        wrapped = guardrails.apply_output(body, rep, grounded, urgent=urgent, emergency=emergency)
        answer = {
            "answer": wrapped["answer"], "banners": wrapped["banners"], "guardrail_notes": wrapped["guardrail_notes"],
            "disclaimer": wrapped["disclaimer"], "grounded": grounded, "interaction_alerts": extra,
            "citations": [{"n": i, "id": r["id"], "title": r["title"], "category": r["category"], "source": r["source"],
                           "score": r["score"], "snippet": r["snippet"]} for i, r in enumerate(sources[:3], 1)],
            "confidence": round(sources[0]["score"], 2) if sources else 0.0,
            "provider": out["provider"], "latency_ms": int((time.time() - t0) * 1000),
            "patient_context": profile, "query_used": q,
        }
        self.memory.remember(session_id, "assistant", wrapped["answer"][:300])
        return answer
