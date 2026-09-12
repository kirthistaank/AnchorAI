"""Input/Output Guardrails for safety and security"""
import re
from typing import Tuple, Dict, Any
import logging

logger = logging.getLogger(__name__)


class GuardrailsEngine:
    """Safety guardrails for input and output"""

    # PII patterns
    PII_PATTERNS = {
        "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "phone": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
        "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
        "credit_card": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
    }

    # Prompt injection indicators
    PROMPT_INJECTION_PATTERNS = [
        r"ignore previous instructions?",
        r"forget your instructions?",
        r"system prompt",
        r"jailbreak",
        r"override",
        r"bypass",
        r"execute code",
        r"run command",
    ]

    # Crisis signals (concerning words)
    CRISIS_SIGNALS = [
        "suicide",
        "self-harm",
        "kill myself",
        "end my life",
        "harm myself",
        "overdose",
        "cut myself",
        "starve myself",
        "starving myself",
        "want to starve",
        "jump off",
        "jump from",
        "want to jump",
        "going to jump",
    ]

    SENSITIVE_KEYWORDS = [
        "password",
        "secret key",
        "api key",
        "token",
        "credential",
    ]

    @staticmethod
    def scrub_pii(text: str) -> Tuple[str, Dict[str, int]]:
        """Remove PII from text, return scrubbed text and detection counts"""
        scrubbed = text
        pii_detected = {}

        for pii_type, pattern in GuardrailsEngine.PII_PATTERNS.items():
            matches = re.findall(pattern, scrubbed)
            if matches:
                pii_detected[pii_type] = len(matches)
                scrubbed = re.sub(pattern, f"[{pii_type.upper()}]", scrubbed)

        return scrubbed, pii_detected

    @staticmethod
    def detect_prompt_injection(text: str) -> Tuple[bool, str]:
        """Detect prompt injection attempts"""
        text_lower = text.lower()

        for pattern in GuardrailsEngine.PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, text_lower):
                return True, f"Suspected prompt injection pattern: {pattern}"

        return False, ""

    @staticmethod
    def detect_crisis_signals(text: str) -> Tuple[bool, list]:
        """Detect crisis/safety signals"""
        text_lower = text.lower()
        signals_found = []

        for signal in GuardrailsEngine.CRISIS_SIGNALS:
            if signal.lower() in text_lower:
                signals_found.append(signal)

        return len(signals_found) > 0, signals_found

    @staticmethod
    def inspect_input(text: str) -> Dict[str, Any]:
        """Comprehensive input inspection"""
        result = {
            "safe": True,
            "warnings": [],
            "errors": [],
            "pii_detected": {},
            "prompt_injection_detected": False,
            "crisis_signals_detected": False,
        }

        # Check for prompt injection
        is_injection, pattern = GuardrailsEngine.detect_prompt_injection(text)
        if is_injection:
            result["safe"] = False
            result["prompt_injection_detected"] = True
            result["errors"].append(f"Prompt injection blocked: {pattern}")
            logger.warning(f"Prompt injection attempt detected: {pattern}")

        # Check for PII
        scrubbed, pii_detected = GuardrailsEngine.scrub_pii(text)
        if pii_detected:
            result["pii_detected"] = pii_detected
            result["warnings"].append(f"PII detected and will be masked: {list(pii_detected.keys())}")
            logger.info(f"PII detected in input: {pii_detected}")

        # Check for crisis signals
        has_crisis, signals = GuardrailsEngine.detect_crisis_signals(text)
        if has_crisis:
            result["crisis_signals_detected"] = True
            result["warnings"].append(f"Crisis signals detected: {signals}. Resources provided.")
            logger.warning(f"Crisis signals detected: {signals}")

        return result

    @staticmethod
    def inspect_output(text: str) -> Dict[str, Any]:
        """Inspect agent output for safety issues"""
        result = {
            "safe": True,
            "warnings": [],
            "safety_score": 10.0,
            "concerns": [],
        }

        text_lower = text.lower()

        # Check for crisis signals (should NOT recommend harmful actions)
        harmful_phrases = [
            "you should harm yourself",
            "you should kill yourself",
            "end your life",
            "take your own life",
        ]

        for phrase in harmful_phrases:
            if phrase in text_lower:
                result["safe"] = False
                result["concerns"].append(f"Harmful recommendation detected: {phrase}")
                result["safety_score"] -= 5.0

        # Check for sensitive info leakage
        for keyword in GuardrailsEngine.SENSITIVE_KEYWORDS:
            if keyword in text_lower:
                result["warnings"].append(f"Sensitive keyword found: {keyword}")
                result["safety_score"] -= 1.0

        # Check for medical advice (warn, not block)
        medical_phrases = ["take this medication", "stop taking", "prescribed"]
        for phrase in medical_phrases:
            if phrase in text_lower:
                result["warnings"].append(f"Potential medical advice: {phrase}. Disclaimer needed.")
                result["safety_score"] -= 0.5

        result["safety_score"] = max(0.0, min(10.0, result["safety_score"]))
        return result

    @staticmethod
    def get_crisis_resources() -> Dict[str, str]:
        """Return crisis support resources"""
        return {
            "988_suicide_lifeline": "Call 988 (US)",
            "crisis_text_line": "Text HOME to 741741",
            "international_helpline": "https://findahelpline.com",
            "emergency": "Call 911 (US) or local emergency number",
        }

    @staticmethod
    def format_crisis_response() -> str:
        """Format a crisis response"""
        resources = GuardrailsEngine.get_crisis_resources()
        return f"""
I notice you may be in crisis. Please reach out for immediate help:

🆘 **Immediate Support:**
- **National Suicide Prevention Lifeline:** 988 (call or text)
- **Crisis Text Line:** Text HOME to 741741
- **Emergency:** Call 911

I'm here to support you, but trained crisis counselors are better equipped to help right now.
Please reach out to one of these resources. You matter. 💙
"""
