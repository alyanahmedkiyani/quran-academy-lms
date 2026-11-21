"""Start the test app.   python run.py            (http://localhost:8000)
                        python run.py --https    (self-signed HTTPS, needed for the microphone from other devices)"""
import ipaddress
import sys
from datetime import datetime, timedelta, timezone

import uvicorn

from app import config


def make_cert():
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    cert_f, key_f = config.DATA_DIR / "cert.pem", config.DATA_DIR / "key.pem"
    if cert_f.exists() and key_f.exists():
        return str(cert_f), str(key_f)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "qalms-ai-moderation")])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(days=1))
            .not_valid_after(now + timedelta(days=365))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost"),
                                                        x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), False)
            .sign(key, hashes.SHA256()))
    cert_f.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_f.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                                        serialization.NoEncryption()))
    return str(cert_f), str(key_f)


if __name__ == "__main__":
    kw = {}
    if "--https" in sys.argv:
        kw["ssl_certfile"], kw["ssl_keyfile"] = make_cert()
        print("HTTPS with a self-signed certificate: the browser will warn once, choose 'continue'.")
    print(config.describe())
    host = "0.0.0.0" if "--lan" in sys.argv else config.HOST
    scheme = "https" if kw else "http"
    print(f"Open {scheme}://localhost:{config.PORT}/  (room)   and   {scheme}://localhost:{config.PORT}/admin  (admin review)")
    uvicorn.run("app.main:app", host=host, port=config.PORT, log_level="info", **kw)
