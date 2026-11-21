"""
Intent Classifier module loaded from the trained joblib artifact.
Provides sub-millisecond intent and policy violation prediction for text / utterances.
"""
from pathlib import Path
import joblib
from .normalize import norm

MODEL_PATH = Path(__file__).resolve().parent / "intent_model.joblib"

_MODEL_DATA = None


def get_model():
    global _MODEL_DATA
    if _MODEL_DATA is None:
        if not MODEL_PATH.exists():
            return None
        _MODEL_DATA = joblib.load(MODEL_PATH)
    return _MODEL_DATA


def predict_intent(raw_text: str, threshold: float = 0.70):
    """
    Classify intent of text across English, Urdu, and Roman Urdu.
    Returns:
        dict with {
            'is_suspicious': bool,
            'confidence': float,
            'category': str,
            'risk_level': str,
            'intent': str,
            'text': str
        }
    """
    model_data = get_model()
    if not model_data or not raw_text or not raw_text.strip():
        return {
            "is_suspicious": False,
            "confidence": 0.0,
            "category": "normal_class_scheduling",
            "risk_level": "none_or_contextual",
            "intent": "",
            "text": raw_text
        }
    
    cleaned = norm(raw_text)
    if not cleaned:
        return {
            "is_suspicious": False,
            "confidence": 0.0,
            "category": "normal_class_scheduling",
            "risk_level": "none_or_contextual",
            "intent": "",
            "text": raw_text
        }

    binary_clf = model_data["binary_model"]
    cat_clf = model_data["category_model"]
    cat_to_risk = model_data["cat_to_risk"]
    cat_to_intent = model_data["cat_to_intent"]

    # Predict binary probability (index 1 is 'suspicious_intent')
    probs = binary_clf.predict_proba([cleaned])[0]
    suspicious_conf = float(probs[1]) if len(probs) > 1 else float(probs[0])
    is_suspicious = suspicious_conf >= threshold

    if is_suspicious:
        cat_probs = cat_clf.predict_proba([cleaned])[0]
        top_idx = int(cat_probs.argmax())
        category = str(cat_clf.classes_[top_idx])
        risk_level = cat_to_risk.get(category, "medium")
        intent_desc = cat_to_intent.get(category, category.replace("_", " ").title())
    else:
        category = "normal_class_scheduling"
        risk_level = "none_or_contextual"
        intent_desc = "Normal conversation"

    return {
        "is_suspicious": is_suspicious,
        "confidence": round(suspicious_conf, 3),
        "category": category,
        "risk_level": risk_level,
        "intent": intent_desc,
        "text": raw_text
    }
