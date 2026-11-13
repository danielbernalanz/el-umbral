import struct, hashlib
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
CHUNK = 1 << 20
V2_ID = 0x7109871a
def lp(b): return struct.pack("<I", len(b)) + b
def chunks_digest(parts):
    ds = []
    for part in parts:
        for i in range(0, len(part), CHUNK):
            c = part[i:i + CHUNK]
            ds.append(hashlib.sha256(b"\xa5" + struct.pack("<I", len(c)) + c).digest())
    return hashlib.sha256(b"\x5a" + struct.pack("<I", len(ds)) + b"".join(ds)).digest()
def eocd_info(data):
    e = data.rfind(b"PK\x05\x06")
    return e, struct.unpack_from("<I", data, e + 16)[0]
def sign_v2(data, key, cert_der):
    e, cd = eocd_info(data)
    digest = chunks_digest([data[:cd], data[cd:e], data[e:]])
    algo = 0x0103
    digests = lp(struct.pack("<I", algo) + lp(digest))
    signed = lp(digests) + lp(lp(cert_der)) + lp(b"")
    sig = key.sign(signed, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed) + lp(lp(struct.pack("<I", algo) + lp(sig))) + lp(pub)
    v2 = lp(lp(signer))
    pair = struct.pack("<Q", 4 + len(v2)) + struct.pack("<I", V2_ID) + v2
    size = len(pair) + 8 + 16
    block = struct.pack("<Q", size) + pair + struct.pack("<Q", size) + b"APK Sig Block 42"
    eocd = bytearray(data[e:]); struct.pack_into("<I", eocd, 16, cd + len(block))
    return data[:cd] + block + data[cd:e] + bytes(eocd)
def read_block(apk):
    e, cd = eocd_info(apk)
    assert apk[cd - 16:cd] == b"APK Sig Block 42", "sin bloque de firma"
    size = struct.unpack_from("<Q", apk, cd - 24)[0]
    start = cd - size - 8
    pairs, p, end = {}, start + 8, cd - 24
    while p < end:
        l = struct.unpack_from("<Q", apk, p)[0]; i = struct.unpack_from("<I", apk, p + 8)[0]
        pairs[i] = apk[p + 12:p + 8 + l]; p += 8 + l
    return e, cd, start, pairs
def rd(b, p):
    n = struct.unpack_from("<I", b, p)[0]; return b[p + 4:p + 4 + n], p + 4 + n
def verify_v2(apk):
    e, cd, start, pairs = read_block(apk)
    ids = [hex(i) for i in pairs]
    if V2_ID not in pairs: return {"ids": ids, "v2": False}
    signers, _ = rd(pairs[V2_ID], 0); signer, _ = rd(signers, 0)
    signed, p = rd(signer, 0); sigs, p = rd(signer, p); pub, p = rd(signer, p)
    dseq, _ = rd(signed, 0); dent, _ = rd(dseq, 0)
    algo = struct.unpack_from("<I", dent, 0)[0]; dig, _ = rd(dent, 4)
    eocd = bytearray(apk[e:]); struct.pack_into("<I", eocd, 16, start)
    mine = chunks_digest([apk[:start], apk[cd:e], bytes(eocd)])
    res = {"ids": ids, "v2": True, "algo": hex(algo), "digest_ok": mine == dig}
    if algo == 0x0103:
        sent, _ = rd(sigs, 0); sa = struct.unpack_from("<I", sent, 0)[0]; sig, _ = rd(sent, 4)
        k = serialization.load_der_public_key(pub)
        try: k.verify(sig, signed, padding.PKCS1v15(), hashes.SHA256()); res["sig_ok"] = True
        except Exception as ex: res["sig_ok"] = False
    return res
