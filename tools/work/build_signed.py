import sys, io, struct, zipfile, datetime, os
sys.path.insert(0, "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/work")
import apksign
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
S = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
SRC = "/mnt/user-data/attachments/7b586fea-69a6-5d02-a28a-5cd182c7f952/67514ac8-ElUmbral-v0_6_3.apk"
WWW = S + "apk/assets/www/"
NEW_VC, NEW_VN, OLD_VN = 50, "1.6.2", "0.6.3"
OUT = "/mnt/user-data/outputs/ElUmbral-v1_6_2-firmado.apk"

def patch_manifest(b):
    b = bytearray(b); pool = 8
    n = struct.unpack_from("<I", b, pool + 8)[0]; flags = struct.unpack_from("<I", b, pool + 16)[0]; sstart = struct.unpack_from("<I", b, pool + 20)[0]
    utf8 = bool(flags & 0x100); offs = struct.unpack_from("<%dI" % n, b, pool + 28); names = {}
    for i, o in enumerate(offs):
        p = pool + sstart + o
        if utf8:
            l = b[p]; p += 1
            if l & 0x80: p += 1
            bl = b[p]; p += 1
            if bl & 0x80: bl = ((bl & 0x7f) << 8) | b[p]; p += 1
            names[i] = (bytes(b[p:p + bl]).decode("utf8", "replace"), p, bl)
        else:
            l = struct.unpack_from("<H", b, p)[0]; p += 2
            names[i] = (bytes(b[p:p + 2 * l]).decode("utf-16-le"), p, 2 * l)
    rep = {}
    for i, (s, p, ln) in names.items():
        if s == OLD_VN:
            enc = NEW_VN.encode("utf8") if utf8 else NEW_VN.encode("utf-16-le")
            assert len(enc) == ln; b[p:p + ln] = enc; rep["versionName"] = True
    idx = [i for i, (s, p, ln) in names.items() if s == "versionCode"][0]
    pat = struct.pack("<I", idx) + b"\xff\xff\xff\xff" + struct.pack("<HBBI", 8, 0, 0x10, 9)
    pos = bytes(b).find(pat); assert pos >= 0, "versionCode=9 no encontrado"
    struct.pack_into("<I", b, pos + 16, NEW_VC); rep["versionCode"] = True
    return bytes(b), rep

changed = set()
for r, _, fs in os.walk(WWW):
    for f in fs:
        changed.add("assets/www/" + os.path.relpath(os.path.join(r, f), WWW).replace(os.sep, "/"))
buf = io.BytesIO()
with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(buf, "w") as zout:
    for info in zin.infolist():
        if info.filename in changed: data = open(WWW + info.filename[len("assets/www/"):], "rb").read()
        elif info.filename == "AndroidManifest.xml": data, rep = patch_manifest(zin.read(info.filename)); print("manifiesto:", rep)
        else: data = zin.read(info.filename)
        zi = zipfile.ZipInfo(info.filename, date_time=info.date_time); zi.compress_type = info.compress_type; zi.external_attr = info.external_attr
        zout.writestr(zi, data)
    have = {i.filename for i in zin.infolist()}
    for n in sorted(changed - have):
        zi = zipfile.ZipInfo(n, date_time=(2026, 11, 12, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = 0o644 << 16
        zout.writestr(zi, open(WWW + n[len("assets/www/"):], "rb").read())
unsigned = buf.getvalue()

# clave persistente (se reutiliza en futuras versiones)
kp = S + "work/umbral-key.pem"; cp = S + "work/umbral-cert.pem"
if os.path.exists(kp):
    key = serialization.load_pem_private_key(open(kp, "rb").read(), None); cert = x509.load_pem_x509_certificate(open(cp, "rb").read())
else:
    key = rsa.generate_private_key(65537, 2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "El Umbral"), x509.NameAttribute(NameOID.ORGANIZATION_NAME, "El Umbral")])
    now = datetime.datetime(2026, 1, 1)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=36500)).sign(key, hashes.SHA256()))
    open(kp, "wb").write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    open(cp, "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    p12 = pkcs12.serialize_key_and_certificates(b"umbral", key, cert, None, serialization.BestAvailableEncryption(b"umbral"))
    open("/mnt/user-data/outputs/ElUmbral-clave-firma.p12", "wb").write(p12)
signed = apksign.sign_v2(unsigned, key, cert.public_bytes(serialization.Encoding.DER))
open(OUT, "wb").write(signed)
print("firma propia ->", apksign.verify_v2(signed))
z = zipfile.ZipFile(OUT); print("zip testzip:", z.testzip(), "| entradas:", len(z.infolist()), "| bytes:", len(signed))
print("assets coinciden con la carpeta de trabajo:", all(z.read(n) == open(WWW + n[len("assets/www/"):], "rb").read() for n in changed))
