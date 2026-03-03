"""
Advanced Integrations Module for MeetScribe
Supports: Attio, Notion, Slack, HubSpot, Affinity, and Zapier
"""

import os
import json
import httpx
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class IntegrationType(Enum):
    """Supported integration types"""
    ATTIO = "attio"
    NOTION = "notion"
    SLACK = "slack"
    HUBSPOT = "hubspot"
    AFFINITY = "affinity"
    ZAPIER = "zapier"


class IntegrationManager:
    """Manages all third-party integrations"""
    
    def __init__(self):
        self.integrations = {
            IntegrationType.ATTIO: AttioIntegration(),
            IntegrationType.NOTION: NotionIntegration(),
            IntegrationType.SLACK: SlackIntegration(),
            IntegrationType.HUBSPOT: HubSpotIntegration(),
            IntegrationType.AFFINITY: AffinityIntegration(),
            IntegrationType.ZAPIER: ZapierIntegration(),
        }
    
    async def send_transcript(self, integration_type: IntegrationType, 
                             transcript_data: Dict[str, Any],
                             config: Dict[str, Any]) -> Dict[str, Any]:
        """Send transcript to specified integration"""
        try:
            integration = self.integrations.get(integration_type)
            if not integration:
                raise ValueError(f"Integration {integration_type} not supported")
            
            result = await integration.send_data(transcript_data, config)
            logger.info(f"Successfully sent to {integration_type.value}")
            return {"success": True, "data": result}
        except Exception as e:
            logger.error(f"Error sending to {integration_type.value}: {str(e)}")
            return {"success": False, "error": str(e)}


class AttioIntegration:
    """Attio CRM Integration"""
    
    BASE_URL = "https://api.attio.com/v2"
    
    async def send_data(self, transcript_data: Dict[str, Any], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send transcript to Attio CRM
        Creates a note/activity in Attio with meeting transcript
        """
        api_key = config.get("api_key") or os.getenv("ATTIO_API_KEY")
        workspace_id = config.get("workspace_id")
        
        if not api_key:
            raise ValueError("Attio API key not provided")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Format transcript data for Attio
        note_data = {
            "data": {
                "title": transcript_data.get("title", "Meeting Transcript"),
                "content": self._format_transcript(transcript_data),
                "format": "plaintext",
                "created_at": datetime.now().isoformat(),
                "parent_object": config.get("parent_object", "people"),
                "parent_record_id": config.get("parent_record_id")
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/notes",
                headers=headers,
                json=note_data,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    
    def _format_transcript(self, data: Dict[str, Any]) -> str:
        """Format transcript for Attio"""
        formatted = f"""Meeting Transcript
        
Date: {data.get('timestamp', datetime.now().isoformat())}
Duration: {data.get('duration', 'N/A')}
Language: {data.get('language', 'auto')}

Transcript:
{data.get('text', '')}

---

Summary:
{data.get('summary', 'No summary available')}

Key Points:
"""
        return formatted


class NotionIntegration:
    """Notion Integration"""
    
    BASE_URL = "https://api.notion.com/v1"
    
    async def send_data(self, transcript_data: Dict[str, Any], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """Send transcript to Notion database or page"""
        api_key = config.get("api_key") or os.getenv("NOTION_API_KEY")
        parent_id = config.get("parent_id") # Database or Page ID
        
        if not api_key:
            raise ValueError("Notion API key not provided")
            
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
        }
        
        # Create a new page in the database
        page_data = {
            "parent": {"database_id": parent_id} if config.get("is_database", True) else {"page_id": parent_id},
            "properties": {
                "Name": {
                    "title": [
                        {"text": {"content": transcript_data.get("title", "Meeting Transcript")}}
                    ]
                },
                "Date": {
                    "date": {"start": datetime.now().isoformat()}
                }
            },
            "children": [
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Summary"}}]}
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": transcript_data.get("summary", "")}}]}
                },
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Full Transcript"}}]}
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": transcript_data.get("text", "")[:2000]}}]}
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/pages",
                headers=headers,
                json=page_data
            )
            response.raise_for_status()
            return response.json()


class SlackIntegration:
    """Slack Integration"""
    
    async def send_data(self, transcript_data: Dict[str, Any], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """Send summary to Slack channel"""
        webhook_url = config.get("webhook_url") or os.getenv("SLACK_WEBHOOK_URL")
        
        if not webhook_url:
            raise ValueError("Slack Webhook URL not provided")
            
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "📝 New Meeting Transcript Ready"}
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",                    "text": f"*Title:* {transcript_data.get('title', 'Meeting')}\n
*Summary:* {transcript_data.get('summary', '')}"
                }
            },
            {
                "type": "divider"
            }
        ]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json={"blocks": blocks}
            )
            response.raise_for_status()
            return {"status": "sent"}


class HubSpotIntegration:
    """HubSpot CRM Integration"""
    
    BASE_URL = "https://api.hubapi.com/crm/v3"
    
    async def send_data(self, transcript_data: Dict[str, Any], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a note in HubSpot CRM"""
        api_key = config.get("api_key") or os.getenv("HUBSPOT_API_KEY")
        
        if not api_key:
            raise ValueError("HubSpot API key not provided")
            
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Create an engagement (note)
        note_data = {
            "properties": {
                "hs_note_body": f"Meeting Transcript: {transcript_data.get('summary', '')}

Full Text: {transcript_data.get('text', '')}",
                "hs_timestamp": datetime.now().isoformat()
            }
        }
        
        async with httpx.AsyncClient() as client:
            # First create the note
            response = await client.post(
                f"{self.BASE_URL}/objects/notes",
                headers=headers,
                json=note_data
            )
            response.raise_for_status()
            note_result = response.json()
            
            # Optionally associate with a contact/company
            if config.get("contact_id"):
                note_id = note_result["id"]
                contact_id = config.get("contact_id")
                await client.put(
                    f"{self.BASE_URL}/objects/notes/{note_id}/associations/contact/{contact_id}/note_to_contact",
                    headers=headers
                )
                
            return note_result


class AffinityIntegration:
    """Affinity CRM Integration"""
    
    BASE_URL = "https://api.affinity.co"
    
    async def send_data(self, transcript_data: Dict[str, Any], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a note in Affinity"""
        api_key = config.get("api_key") or os.getenv("AFFINITY_API_KEY")
        
        if not api_key:
            raise ValueError("Affinity API key not provided")
            
        auth = httpx.BasicAuth("", api_key)
        
        note_data = {
            "content": f"MeetScribe Transcript

Summary: {transcript_data.get('summary', '')}

Transcript: {transcript_data.get('text', '')}",
            "person_ids": config.get("person_ids", []),
            "organization_ids": config.get("organization_ids", []),
            "opportunity_ids": config.get("opportunity_ids", [])
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/notes",
                auth=auth,
                json=note_data
            )
            response.raise_for_status()
            return response.json()


class ZapierIntegration:
    """Zapier Integration via Webhook"""
    
    async def send_data(self, transcript_data: Dict[str, Any], 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """Send data to a Zapier Webhook"""
        webhook_url = config.get("webhook_url")
        
        if not webhook_url:
            raise ValueError("Zapier Webhook URL not provided")
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=transcript_data
            )
            response.raise_for_status()
            return {"status": "triggered"}
