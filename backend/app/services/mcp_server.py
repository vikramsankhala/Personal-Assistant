"""
MeetScribe MCP (Model Context Protocol) Server
==============================================
Exposes MeetScribe transcript tools via the MCP standard so any
MCP-compatible AI client (Claude Desktop, Cursor, Continue, etc.)
can call them directly.

Tools exposed:
  - get_transcript        : fetch a stored transcript by ID
  - search_transcripts    : semantic search over all transcripts
  - get_action_items      : extract/return action items for a transcript
  - ask_meeting           : semantic Q&A over transcripts
  - get_sentiment         : per-speaker sentiment for a transcript
  - create_task           : push an action item to Jira / Linear / Asana
  - run_agentic_workflow  : multi-step agentic pipeline with approval gate
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MCP Tool registry – lightweight, no heavy SDK required
# The /mcp endpoint in main.py serves the MCP manifest + tool calls.
# ---------------------------------------------------------------------------

MCP_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "get_transcript",
        "description": "Retrieve a full transcript (text, summary, segments) by transcript ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transcript_id": {"type": "string", "description": "UUID of the transcript"}
            },
            "required": ["transcript_id"]
        }
    },
    {
        "name": "search_transcripts",
        "description": "Semantic search over all stored transcripts. Returns ranked excerpts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language search query"},
                "top_k": {"type": "integer", "default": 5, "description": "Number of results"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_action_items",
        "description": "Extract action items with owners, due dates, and status from a transcript.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transcript_id": {"type": "string"},
                "role_template": {
                    "type": "string",
                    "enum": ["sales", "product", "cs", "exec", "general"],
                    "default": "general"
                }
            },
            "required": ["transcript_id"]
        }
    },
    {
        "name": "ask_meeting",
        "description": "Ask a natural-language question over one or many meeting transcripts. E.g. 'What was agreed on pricing with ACME last quarter?'",
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "transcript_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional list of transcript IDs to scope the search"
                },
                "account_name": {"type": "string", "description": "Optional company/person name filter"}
            },
            "required": ["question"]
        }
    },
    {
        "name": "get_sentiment",
        "description": "Return per-speaker sentiment timeline, churn-risk flags, and buying-signal flags.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transcript_id": {"type": "string"},
                "detect_escalation": {"type": "boolean", "default": True}
            },
            "required": ["transcript_id"]
        }
    },
    {
        "name": "create_task",
        "description": "Push an action item into a task management tool (Jira, Linear, Asana, ClickUp).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "assignee": {"type": "string"},
                "due_date": {"type": "string", "format": "date"},
                "tool": {
                    "type": "string",
                    "enum": ["jira", "linear", "asana", "clickup"],
                    "default": "linear"
                },
                "transcript_id": {"type": "string"}
            },
            "required": ["title", "tool"]
        }
    },
    {
        "name": "run_agentic_workflow",
        "description": "Run a multi-step agentic workflow (e.g. extract tasks -> write customer email -> create Jira tickets -> update CRM). Returns a plan for user approval before execution.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transcript_id": {"type": "string"},
                "workflow_type": {
                    "type": "string",
                    "enum": ["post_sales_call", "post_cs_call", "post_product_review", "post_exec_sync"],
                    "default": "post_sales_call"
                },
                "approved": {"type": "boolean", "default": False,
                             "description": "Set True to execute after previewing the plan"}
            },
            "required": ["transcript_id", "workflow_type"]
        }
    }
]


def get_mcp_manifest(base_url: str) -> Dict[str, Any]:
    """Return the MCP server manifest (for /.well-known/mcp.json)."""
    return {
        "schema_version": "v1",
        "name": "meetscribe",
        "display_name": "MeetScribe",
        "description": "AI meeting transcription, summaries, action items, and CRM sync",
        "version": "1.0.0",
        "tools": MCP_TOOLS,
        "endpoints": {
            "tools_call": f"{base_url}/mcp/tools/call",
            "tools_list": f"{base_url}/mcp/tools/list"
        }
    }


async def dispatch_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    db=None
) -> Dict[str, Any]:
    """
    Route an MCP tool call to the appropriate service function.
    Returns a dict with 'content' list as per MCP spec.
    """
    try:
        if tool_name == "get_transcript":
            result = await _tool_get_transcript(arguments, db)
        elif tool_name == "search_transcripts":
            result = await _tool_search_transcripts(arguments, db)
        elif tool_name == "get_action_items":
            result = await _tool_get_action_items(arguments, db)
        elif tool_name == "ask_meeting":
            result = await _tool_ask_meeting(arguments, db)
        elif tool_name == "get_sentiment":
            result = await _tool_get_sentiment(arguments, db)
        elif tool_name == "create_task":
            result = await _tool_create_task(arguments)
        elif tool_name == "run_agentic_workflow":
            result = await _tool_agentic_workflow(arguments, db)
        else:
            return {"isError": True, "content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}]}

        return {
            "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]
        }
    except Exception as e:
        logger.error(f"MCP tool {tool_name} error: {e}")
        return {"isError": True, "content": [{"type": "text", "text": str(e)}]}


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def _tool_get_transcript(args: Dict, db) -> Dict:
    from sqlalchemy import select
    from app.models.transcript import Transcript
    tid = args["transcript_id"]
    result = await db.execute(select(Transcript).where(Transcript.id == tid))
    t = result.scalar_one_or_none()
    if not t:
        return {"error": "Transcript not found"}
    return {
        "id": str(t.id),
        "title": t.title,
        "text": t.text,
        "summary": t.summary,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


async def _tool_search_transcripts(args: Dict, db) -> Dict:
    """Semantic search using existing RAG pipeline."""
    try:
        from app.services.rag import search_transcripts
        query = args["query"]
        top_k = args.get("top_k", 5)
        results = await search_transcripts(query, top_k=top_k, db=db)
        return {"results": results}
    except Exception as e:
        # Fallback: basic text search
        from sqlalchemy import select, or_
        from app.models.transcript import Transcript
        query = args["query"]
        result = await db.execute(
            select(Transcript).where(
                or_(Transcript.text.ilike(f"%{query}%"),
                    Transcript.summary.ilike(f"%{query}%"))
            ).limit(args.get("top_k", 5))
        )
        rows = result.scalars().all()
        return {"results": [{"id": str(r.id), "title": r.title, "excerpt": (r.text or "")[:300]} for r in rows]}


async def _tool_get_action_items(args: Dict, db) -> Dict:
    from app.services.ai_pipeline import extract_action_items
    tid = args["transcript_id"]
    role = args.get("role_template", "general")
    items = await extract_action_items(tid, role_template=role, db=db)
    return {"action_items": items}


async def _tool_ask_meeting(args: Dict, db) -> Dict:
    from app.services.ai_pipeline import ask_meeting_qa
    answer = await ask_meeting_qa(
        question=args["question"],
        transcript_ids=args.get("transcript_ids"),
        account_name=args.get("account_name"),
        db=db
    )
    return {"answer": answer}


async def _tool_get_sentiment(args: Dict, db) -> Dict:
    from app.services.ai_pipeline import analyze_sentiment
    tid = args["transcript_id"]
    result = await analyze_sentiment(tid, detect_escalation=args.get("detect_escalation", True), db=db)
    return result


async def _tool_create_task(args: Dict) -> Dict:
    from app.services.task_integrations import create_task
    return await create_task(
        title=args["title"],
        description=args.get("description", ""),
        assignee=args.get("assignee"),
        due_date=args.get("due_date"),
        tool=args.get("tool", "linear")
    )


async def _tool_agentic_workflow(args: Dict, db) -> Dict:
    from app.services.agentic import run_workflow
    return await run_workflow(
        transcript_id=args["transcript_id"],
        workflow_type=args["workflow_type"],
        approved=args.get("approved", False),
        db=db
    )
