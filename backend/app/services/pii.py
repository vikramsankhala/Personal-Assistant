"""PII redaction using Presidio (optional)."""

import logging
from app.config import get_settings

logger = logging.getLogger(__name__)


def redact_pii(text: str) -> str:
    """Redact PII from text before storage."""
    settings = get_settings()
    if not settings.pii_redaction_enabled:
        return text

    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_anonymizer import AnonymizerEngine

        analyzer = AnalyzerEngine()
        anonymizer = AnonymizerEngine()

        results = analyzer.analyze(
            text=text,
            language="en",
            entities=["EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON", "CREDIT_CARD", "US_SSN"],
        )
        return anonymizer.anonymize(text=text, analyzer_results=results).text
    except Exception as e:
        logger.warning("PII redaction failed: %s", e)
        return text
