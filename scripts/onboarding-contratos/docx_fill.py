"""Substituição de texto em .docx (Word), mesmo quando o texto está partido por várias runs."""
from __future__ import annotations

import html
import re
import zipfile

_T = re.compile(r'(<w:t(?: [^>]*)?>)([^<]*)(</w:t>)')


def _replace_once(xml: str, old: str, new: str):
    ms = list(_T.finditer(xml))
    texts = [html.unescape(m.group(2)) for m in ms]
    full = "".join(texts)
    i = full.find(old)
    if i < 0:
        return xml, False
    j = i + len(old)
    out, last, pos, first = [], 0, 0, True
    for m, t in zip(ms, texts):
        a, b = pos, pos + len(t)
        pos = b
        if b <= i or a >= j:
            continue
        nt = t[: max(i, a) - a] + (new if first else "") + t[min(j, b) - a:]
        first = False
        op = m.group(1)
        if "xml:space" not in op:
            op = op.replace("<w:t", '<w:t xml:space="preserve"', 1)
        out.append(xml[last:m.start()] + op + html.escape(nt, quote=False) + m.group(3))
        last = m.end()
    out.append(xml[last:])
    return "".join(out), True


def replace_all(xml: str, old: str, new: str) -> tuple[str, int]:
    if not old or old in new:
        raise ValueError(f"substituição inválida: {old!r}")
    n = 0
    while True:
        xml, ok = _replace_once(xml, old, new)
        if not ok:
            return xml, n
        n += 1


def fill_docx(src: str, dst: str, values: dict[str, str]) -> dict[str, int]:
    """Copia src para dst substituindo cada chave pelo valor em word/document.xml."""
    zin = zipfile.ZipFile(src)
    xml = zin.read("word/document.xml").decode("utf-8")
    counts = {}
    for k, v in values.items():
        xml, counts[k] = replace_all(xml, k, v)
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = xml.encode("utf-8") if item.filename == "word/document.xml" else zin.read(item.filename)
            zout.writestr(item, data)
    return counts


def docx_text(path: str) -> str:
    x = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    return html.unescape("".join(_T.findall(x) and [m[1] for m in _T.findall(x)]))
