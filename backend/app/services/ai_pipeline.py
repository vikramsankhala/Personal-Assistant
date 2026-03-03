"""AI Pipeline with Hugging Face Inference API

Lightweight AI processing using Hugging Face's free Inference API
instead of local models to reduce memory footprint.
"""

import os
import httpx
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

# Hugging Face Inference API configuration
HF_API_URL = "https://api-inference.huggingface.co/models"
HF_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN", "")

# Model configurations
MODELS = {
    "sentiment": "distilbert-base-uncased-finetuned-sst-2-english",
    "summarization": "facebook/bart-large-cnn",
    "ner": "dslim/bert-base-NER",
    "classification": "facebook/bart-large-mnli",
    "question_answering": "deepset/roberta-base-squad2",
    "text_generation": "gpt2"
}


class HuggingFaceAIPipeline:
    """Lightweight AI pipeline using Hugging Face Inference API"""
    
    def __init__(self):
        self.headers = {
            "Authorization": f"Bearer {HF_API_TOKEN}"
        } if HF_API_TOKEN else {}
    
    async def _query_model(self, model_name: str, payload: Dict[str, Any]) -> Any:
        """Query Hugging Face Inference API"""
        url = f"{HF_API_URL}/{model_name}"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error querying model {model_name}: {e}")
            return None
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        result = await self._query_model(
            MODELS["sentiment"],
            {"inputs": text}
        )
        
        if result and isinstance(result, list) and len(result) > 0:
            # Get highest confidence label
            sentiment = max(result[0], key=lambda x: x['score'])
            return {
                "label": sentiment['label'],
                "score": sentiment['score']
            }
        
        return {"label": "NEUTRAL", "score": 0.5}
    
    async def summarize_text(self, text: str, max_length: int = 130, min_length: int = 30) -> str:
        """Generate summary of text"""
        result = await self._query_model(
            MODELS["summarization"],
            {
                "inputs": text,
                "parameters": {
                    "max_length": max_length,
                    "min_length": min_length,
                    "do_sample": False
                }
            }
        )
        
        if result and isinstance(result, list) and len(result) > 0:
            return result[0].get('summary_text', text[:200])
        
        return text[:200]  # Fallback to truncation
    
    async def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract named entities from text"""
        result = await self._query_model(
            MODELS["ner"],
            {"inputs": text}
        )
        
        if result and isinstance(result, list):
            # Group consecutive entities
            entities = []
            for entity in result:
                entities.append({
                    "entity": entity.get('entity_group', entity.get('entity')),
                    "word": entity.get('word'),
                    "score": entity.get('score'),
                    "start": entity.get('start'),
                    "end": entity.get('end')
                })
            return entities
        
        return []
    
    async def classify_text(self, text: str, candidate_labels: List[str]) -> Dict[str, Any]:
        """Classify text into categories"""
        result = await self._query_model(
            MODELS["classification"],
            {
                "inputs": text,
                "parameters": {
                    "candidate_labels": candidate_labels
                }
            }
        )
        
        if result:
            return {
                "labels": result.get('labels', []),
                "scores": result.get('scores', [])
            }
        
        return {"labels": [], "scores": []}
    
    async def answer_question(self, question: str, context: str) -> Dict[str, Any]:
        """Answer question based on context"""
        result = await self._query_model(
            MODELS["question_answering"],
            {
                "inputs": {
                    "question": question,
                    "context": context
                }
            }
        )
        
        if result:
            return {
                "answer": result.get('answer', ''),
                "score": result.get('score', 0.0),
                "start": result.get('start'),
                "end": result.get('end')
            }
        
        return {"answer": "", "score": 0.0}
    
    async def generate_text(self, prompt: str, max_length: int = 100) -> str:
        """Generate text continuation"""
        result = await self._query_model(
            MODELS["text_generation"],
            {
                "inputs": prompt,
                "parameters": {
                    "max_length": max_length,
                    "temperature": 0.7
                }
            }
        )
        
        if result and isinstance(result, list) and len(result) > 0:
            return result[0].get('generated_text', prompt)
        
        return prompt
    
    async def process_transcript(self, transcript: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """Process transcript with AI analysis"""
        
        # Run analyses in parallel
        sentiment = await self.analyze_sentiment(transcript)
        summary = await self.summarize_text(transcript)
        entities = await self.extract_entities(transcript)
        
        # Classify transcript
        categories = [
            "meeting", "interview", "presentation", 
            "discussion", "lecture", "conversation"
        ]
        classification = await self.classify_text(transcript, categories)
        
        return {
            "summary": summary,
            "sentiment": sentiment,
            "entities": entities,
            "classification": classification,
            "word_count": len(transcript.split()),
            "metadata": metadata or {}
        }


# Global pipeline instance
_pipeline = None

def get_pipeline() -> HuggingFaceAIPipeline:
    """Get or create AI pipeline instance"""
    global _pipeline
    if _pipeline is None:
        _pipeline = HuggingFaceAIPipeline()
    return _pipeline
