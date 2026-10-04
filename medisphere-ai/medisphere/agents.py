"""Day 10 - agentic AI: planner -> specialist agents (tool calling) -> safety review -> synthesizer.

The loop is bounded (MAX_AGENT_STEPS), every action is traced, and the final report only uses
facts found in tool observations. Works offline; a live LLM only rewrites the synthesis.
"""
from __future__ import annotations

import time

from . import guardrails, llm, prompts, tools
from .config import MAX_AGENT_STEPS
from .retrieval import HybridRetriever


class ResearchAgent:
    def __init__(self, retriever: HybridRetriever):
        self.retriever = retriever

    def run(self, question: str, provider: str | None = None) -> dict:
        trace: list[dict] = []
        t_start = time.time()

        def log(agent, action, inp, obs):
            trace.append({"n": len(trace) + 1, "agent": agent, "action": action, "input": inp, "observation": obs,
                          "ms": max(1, int((time.time() - t_start) * 1000))})

        rep = guardrails.check_input(question)
        clean = rep["clean_text"]
        log("Guardrail agent", "screen_input", "user question",
            f"PII masked: {len(rep['pii'])}; injection: {rep['flags']['injection']}; self-harm: {rep['flags']['self_harm']}")

        # 1. Planner
        plan = tools.route(clean)
        steps = [{"tool": "search_guidelines", "args": {"query": clean}, "why": "ground the answer in hospital knowledge"}] + plan
        steps = steps[: MAX_AGENT_STEPS - 3]
        log("Planner agent", "make_plan", clean,
            "Plan: " + " -> ".join(s["tool"] for s in steps) + " -> safety_review -> synthesize")

        findings, citations, structured = [], [], {}
        # 2. Specialists
        for s in steps:
            if s["tool"] == "search_guidelines":
                res = self.retriever.search(s["args"]["query"], k=4)
                res = [r for r in res if r["score"] >= max(0.3, (res[0]["score"] * 0.6 if res else 0))]
                for i, r in enumerate(res[:3], 1):
                    citations.append({"n": i, "id": r["id"], "title": r["title"], "source": r["source"], "score": r["score"]})
                    findings.append(f"{r['snippet']} [{i}]")
                log("Retrieval agent", "search_guidelines", s["args"]["query"],
                    f"{len(res)} relevant passage(s): " + ", ".join(r["id"] for r in res[:3]) if res else "no relevant passage found")
            else:
                try:
                    out = tools.call(s["tool"], s["args"])
                except Exception as e:  # tool failure is observed, not fatal
                    log("Specialist agent", s["tool"], s["args"], f"ERROR: {e}")
                    continue
                structured[s["tool"]] = out
                if s["tool"] == "check_drug_interactions":
                    obs = f"{out['count']} interaction(s); worst: {out['worst'] or 'none'}"
                    for p in out["interactions"]:
                        findings.append(f"Drug safety ({p['severity']}): {p['a']} + {p['b']}: {p['effect']} {p['advice']}")
                elif s["tool"] == "calculate_news2":
                    obs = f"NEWS2 = {out['score']} ({out['risk']} risk)"
                    findings.append(f"Vital-sign early warning score is {out['score']} ({out['risk']} risk).")
                elif s["tool"] == "triage_patient":
                    obs = f"Level {out['level']} - {out['level_name']}; department {out['department']}"
                    findings.append(f"Triage suggests level {out['level']} ({out['level_name']}): {out['disposition']}.")
                else:
                    obs = str(out)
                    findings.append(f"BMI {out.get('bmi')} ({out.get('category')})." if "bmi" in out else obs)
                log("Specialist agent", s["tool"], s["args"] if s["tool"] != "triage_patient" else "free-text complaint + vitals", obs)

        # 3. Safety review
        safety = []
        tri = structured.get("triage_patient")
        if tri and tri["escalate"]:
            safety.append("Escalate: emergency criteria met. " + "112 (India) / 911 (US).")
        if rep["flags"]["self_harm"]:
            safety.append(guardrails.SELF_HARM_MESSAGE)
        if rep["flags"]["dose_request"]:
            safety.append("Patient-specific dosing is out of scope; confirm with a pharmacist or prescriber.")
        if not citations and not structured:
            safety.append("Evidence is insufficient to answer; agent abstained.")
        log("Safety agent", "safety_review", f"{len(findings)} finding(s)", f"{len(safety)} safety note(s) raised")

        # 4. Synthesis
        next_steps = tri["recommended_actions"] if tri else ["Review the cited guidance with a clinician before acting."]

        def offline():
            lines = ["Summary of findings:"] + [f"- {f}" for f in findings] if findings else ["No supported findings were retrieved."]
            return "\n".join(lines)

        out = llm.complete(prompts.AGENT_SYSTEM, "Observations:\n" + "\n".join(findings) + f"\nQuestion: {clean}", provider, offline_fn=offline)
        log("Synthesizer agent", "write_report", f"{len(findings)} finding(s)", f"report written via {out['provider']}")
        return {"question": clean, "plan": [s["tool"] for s in steps], "trace": trace,
                "report": {"summary": out["text"], "findings": findings, "safety": safety, "next_steps": next_steps, "citations": citations},
                "steps": len(trace), "max_steps": MAX_AGENT_STEPS, "provider": out["provider"], "total_ms": int((time.time() - t_start) * 1000)}
