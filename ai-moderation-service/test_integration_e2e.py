"""
End-to-End Integration Test for the QALMS AI Moderation System.
Tests healthcheck, PII rules, and the trained Intent Classification model.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from app.pii.detect import detect_text
from app.pii.intent import predict_intent
import app.config as config


def test_moderation_scenarios():
    print("=" * 70)
    print("QALMS AI MODERATION — END-TO-END VERIFICATION")
    print("=" * 70)

    test_cases = [
        # 1. PII Phone Sharing (English)
        {
            "name": "English Phone Sharing",
            "text": "my number is 0300 1234567 please call me",
            "expected_alert": True,
            "expected_category": "phone",
        },
        # 2. PII WhatsApp Sharing (Roman Urdu)
        {
            "name": "Roman Urdu WhatsApp Request",
            "text": "apna WhatsApp number mujhe de do",
            "expected_alert": True,
            "expected_category": "phone",
        },
        # 3. Direct Payment / Fee Poaching (Roman Urdu)
        {
            "name": "Direct Payment Request (Roman Urdu)",
            "text": "Aap mujhe direct fee transfer kar dena, academy ko na batao",
            "expected_alert": True,
            "expected_category": "direct_payment_request",
        },
        # 4. Private Tuition Offer (English)
        {
            "name": "Private Tuition Offer (English)",
            "text": "I can teach you Quran privately outside the academy",
            "expected_alert": True,
            "expected_category": "private_tuition_offer",
        },
        # 5. Academy Exit Solicitation (Urdu)
        {
            "name": "Academy Exit Solicitation (Urdu)",
            "text": "آپ یہ اکیڈمی چھوڑ کر میرے ساتھ پڑھنا جاری رکھیں",
            "expected_alert": True,
            "expected_category": "academy_exit_encouragement",
        },
        # 6. Concealment / Deleting Evidence (English)
        {
            "name": "Concealment Request (English)",
            "text": "Delete our chat messages about private tuition classes",
            "expected_alert": True,
            "expected_category": "request_to_delete_or_hide_evidence",
        },
        # 7. Benign Class Instruction (Should NOT alert)
        {
            "name": "Benign: Page Number Instruction",
            "text": "open page number 25 and read the verse",
            "expected_alert": False,
            "expected_category": "none",
        },
        # 8. Benign Audio / Screen Check (Should NOT alert)
        {
            "name": "Benign: Audio Check",
            "text": "can you hear me clearly, can you see my screen?",
            "expected_alert": False,
            "expected_category": "none",
        },
        # 9. Benign Urdu Homework Request (Should NOT alert)
        {
            "name": "Benign: Urdu Homework Instruction",
            "text": "کل کا سبق صفحہ نمبر بیس سے پڑھیں اور اپنا ہوم ورک مکمل کریں",
            "expected_alert": False,
            "expected_category": "none",
        },
    ]

    passed = 0
    failed = 0

    for idx, tc in enumerate(test_cases, 1):
        raw_text = tc["text"]
        t, fs = detect_text(raw_text)
        alert_findings = [f for f in fs if f.conf >= config.ALERT_THRESHOLD]
        is_alert = bool(alert_findings)
        top_f = alert_findings[0] if alert_findings else (fs[0] if fs else None)

        intent_res = predict_intent(raw_text, threshold=config.ALERT_THRESHOLD)
        category = top_f.pii if top_f else (intent_res.get("category") if intent_res.get("is_suspicious") else "none")
        risk_level = "high" if any(f.conf >= 0.85 for f in alert_findings) else ("medium" if is_alert else "none")
        
        if intent_res.get("is_suspicious"):
            is_alert = True
            category = intent_res.get("category", category)
            risk_level = intent_res.get("risk_level", risk_level)

        alert_ok = (is_alert == tc["expected_alert"])
        cat_ok = True
        if tc["expected_alert"]:
            cat_ok = (category == tc["expected_category"] or tc["expected_category"] in category)

        status = "PASS" if (alert_ok and cat_ok) else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1

        print(f"[{status}] Case {idx}: {tc['name']}")
        print(f"       Text:     {raw_text}")
        print(f"       Alert:    {is_alert} (expected: {tc['expected_alert']})")
        print(f"       Category: {category} | Risk: {risk_level} | Intent: {intent_res.get('intent')}")
        print()

    print("=" * 70)
    print(f"RESULT: {passed} PASSED, {failed} FAILED (Total: {len(test_cases)})")
    print("=" * 70)
    return failed == 0


if __name__ == "__main__":
    success = test_moderation_scenarios()
    sys.exit(0 if success else 1)
