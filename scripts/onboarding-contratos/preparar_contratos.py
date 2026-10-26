#!/usr/bin/env python3
"""Prepara automaticamente a pasta e o contrato de cada novo cliente.

Corre no Mac da admin (launchd, de 10 em 10 minutos). Para cada formulário de novo cliente submetido, com
"Data de início" e "Tratamento" preenchidos na app e ainda sem contrato preparado:
  1. cria Clientes/<Primeiro Último nome>/Contrato/ no OneDrive sincronizado;
  2. preenche o modelo Word do regime (Contabilista Explica/Contrato/Modelos/*.docx, campos «...»);
  3. nos TI copia o Gestor de Negócio para a pasta do cliente;
  4. marca o processo na app (contrato_preparado_at, contrato_ficheiro, pasta_drive) e avisa as admins.
Se faltar algum dado, grava o motivo em contrato_erro (aparece no processo) e tenta de novo na volta seguinte.
"""
from __future__ import annotations
import datetime as dt
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_fill import docx_text, fill_docx, replace_all  # noqa: E402
from genero import FEM_PARA_MASC  # noqa: E402

REF = "unwzlmdwvpxhigmsqvam"
PSQL = "/opt/homebrew/opt/postgresql@17/bin/psql"
CONN = f"host=aws-0-eu-central-1.pooler.supabase.com port=5432 user=postgres.{REF} dbname=postgres sslmode=require"
ONEDRIVE = os.path.expanduser("~/Library/CloudStorage/OneDrive-Pessoal/Jéssica Brandão CC")
CLIENTES = os.path.join(ONEDRIVE, "Clientes")
MODELOS = os.path.join(ONEDRIVE, "Contabilista Explica", "Contrato", "Modelos")
GESTOR = os.path.join(ONEDRIVE, "Contabilista Explica", "2026", "Gestor de Negócio", "Gestor Final_2026.xlsx")
CONFIG = os.path.expanduser("~/Library/Application Support/ContabilistaExplica/config.env")
IVA = 0.23

MODELO = {
    "ti_rs": ("TI RS.docx", "TI Regime Simplificado_{nome}.docx"),
    "ti_co": ("TI CO.docx", "TI Contabilidade Organizada_{nome}.docx"),
    "empresa": ("Empresa.docx", "Contrato_{nome}.docx"),
}
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
         "outubro", "novembro", "dezembro"]


# ---------- valores por extenso (pt-PT) ----------
_U = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze",
      "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove"]
_D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
_C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos",
      "oitocentos", "novecentos"]


def _ate_999(n: int) -> str:
    if n < 20:
        return _U[n]
    if n < 100:
        d, u = divmod(n, 10)
        return _D[d] + ("" if u == 0 else " e " + _U[u])
    if n == 100:
        return "cem"
    c, r = divmod(n, 100)
    return _C[c] + ("" if r == 0 else " e " + _ate_999(r))


def numero_extenso(n: int) -> str:
    if n < 1000:
        return _ate_999(n)
    m, r = divmod(n, 1000)
    s = "mil" if m == 1 else _ate_999(m) + " mil"
    if r == 0:
        return s
    return s + (" e " if r < 100 or r % 100 == 0 else " ") + _ate_999(r)


def euros_extenso(v: float) -> str:
    cent = round(v * 100)
    e, c = divmod(cent, 100)
    partes = []
    if e:
        partes.append(numero_extenso(e) + (" euro" if e == 1 else " euros"))
    if c:
        partes.append(numero_extenso(c) + (" cêntimo" if c == 1 else " cêntimos"))
    return " e ".join(partes) or "zero euros"


def euros_num(v: float) -> str:
    s = f"{v:,.2f}"  # 1,234.50
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def data_extenso(d: dt.date) -> str:
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


# ---------- base de dados ----------
def _env():
    env = dict(os.environ)
    for path in (CONFIG, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "supabase", ".env.migracao")):
        if os.path.exists(path):
            for line in open(path, encoding="utf-8"):
                if line.startswith("GESTAO_DB_PASSWORD="):
                    env["PGPASSWORD"] = line.split("=", 1)[1].strip()
                    return env
    raise SystemExit("Falta GESTAO_DB_PASSWORD em " + CONFIG)


def sql(query: str) -> str:
    r = subprocess.run([PSQL, CONN, "-At", "-v", "ON_ERROR_STOP=1", "-c", query], env=_env(),
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def q(v) -> str:
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


def pendentes() -> list[dict]:
    out = sql("""
        select coalesce(json_agg(x), '[]') from (
          select o.id, o.form_type, o.answers, o.data_inicio, o.genero, o.contrato_erro,
                 l.estimated_value as valor, l.name as lead_nome
          from client_onboardings o left join leads l on l.id = o.lead_id
          where o.submitted_at is not null and o.contrato_preparado_at is null and o.completed_at is null
            and not o.contrato
        ) x""")
    return json.loads(out or "[]")


def marcar_erro(oid: str, msg: str, anterior: str | None):
    if msg != anterior:
        sql(f"update client_onboardings set contrato_erro = {q(msg)} where id = {q(oid)}")


def marcar_ok(oid: str, ficheiro: str, nome: str):
    sql(f"""
        update client_onboardings set contrato_preparado_at = now(), contrato_ficheiro = {q(ficheiro)},
               contrato_erro = null, pasta_drive = true where id = {q(oid)};
        insert into notifications (user_id, title, message, type)
        select ur.user_id, 'Contrato preparado', {q(nome + ' — ' + ficheiro)}, 'onboarding_contrato'
        from user_roles ur where ur.role = 'admin';""")


# ---------- preparação ----------
def nome_pasta(form_type: str, nome: str) -> str:
    nome = " ".join(nome.split()).strip().replace("/", "-")
    if form_type == "empresa":
        return nome
    partes = nome.split(" ")
    return partes[0] if len(partes) == 1 else f"{partes[0]} {partes[-1]}"


def preparar(o: dict) -> tuple[str | None, str | None]:
    a = o.get("answers") or {}
    ft = o["form_type"]
    falta = []
    if not o.get("data_inicio"):
        falta.append("data de início")
    if not o.get("genero"):
        falta.append("tratamento (Sr./Sra.)")
    if not o.get("valor"):
        falta.append("mensalidade na lead")
    for k, lbl in [("nome", "nome"), ("nif", "NIF"), ("morada", "morada"), ("email", "e-mail")]:
        if not a.get(k):
            falta.append(lbl)
    if ft == "empresa":
        for k, lbl in [("gerente_nome", "nome do sócio-gerente"), ("gerente_nif", "NIF do sócio-gerente"),
                       ("gerente_cc", "CC do sócio-gerente"), ("gerente_cc_validade", "validade do CC do sócio-gerente")]:
            if not a.get(k):
                falta.append(lbl)
    if falta:
        return None, "Falta: " + ", ".join(falta)

    modelo, padrao = MODELO[ft]
    src = os.path.join(MODELOS, modelo)
    if not os.path.exists(src):
        return None, f"Modelo em falta: {src}"

    pasta_nome = nome_pasta(ft, a["nome"])
    pasta = os.path.join(CLIENTES, pasta_nome)
    os.makedirs(os.path.join(pasta, "Contrato"), exist_ok=True)
    dst = os.path.join(pasta, "Contrato", padrao.format(nome=pasta_nome))
    if os.path.exists(dst):
        base, ext = os.path.splitext(dst)
        dst = f"{base} (novo){ext}"

    valor_sem = float(o["valor"])
    valor = round(valor_sem * (1 + IVA), 2)
    morada = ", ".join(x for x in [a["morada"].strip(), " ".join(
        x for x in [a.get("codigo_postal", "").strip(), a.get("localidade", "").strip()] if x)] if x)
    inicio = dt.date.fromisoformat(o["data_inicio"]) if o.get("data_inicio") else None
    fem = o["genero"] == "f"
    valores = {
        "«NOME»": a["nome"].strip(), "«NIF»": a["nif"].strip(), "«MORADA»": morada, "«EMAIL»": a["email"].strip(),
        "«CC»": a.get("cartao_cidadao", "").strip(),
        "«DATA_INICIO»": data_extenso(inicio) if inicio else "",
        "«DATA_INICIO_NUM»": inicio.strftime("%d/%m/%Y") if inicio else "",
        "«DATA_CONTRATO»": data_extenso(dt.date.today()),
        "«VALOR»": euros_num(valor), "«VALOR_EXTENSO»": euros_extenso(valor),
        "«VALOR_SEM_IVA»": euros_num(valor_sem), "«VALOR_SEM_IVA_EXTENSO»": euros_extenso(valor_sem),
        "«GERENTE_NOME»": a.get("gerente_nome", "").strip(), "«GERENTE_NIF»": a.get("gerente_nif", "").strip(),
        "«GERENTE_CC»": a.get("gerente_cc", "").strip(), "«GERENTE_CC_VALIDADE»": a.get("gerente_cc_validade", "").strip(),
        "«GERENTE_TITULO»": "sócia-gerente" if fem else "sócio-gerente",
        "«GERENTE_PELO_SEU»": "pela sua" if fem else "pelo seu",
    }
    fill_docx(src, dst, valores)
    if ft != "empresa" and not fem:
        _masculino(dst)
    resto = [c for c in ("«", "»") if c in docx_text(dst)]
    if resto:
        return None, f"O modelo {modelo} tem campos «…» desconhecidos — rever {dst}"

    exportar_pdf(dst)

    if ft in ("ti_rs", "ti_co") and os.path.exists(GESTOR):
        g = os.path.join(pasta, "Gestor de Negócio.xlsx")
        if not os.path.exists(g):
            shutil.copy2(GESTOR, g)
    return os.path.relpath(dst, ONEDRIVE), None


def exportar_pdf(docx: str):
    """PDF ao lado do .docx, exportado pelo Microsoft Word (mantém margens e tipos de letra do modelo).
    O Word (sandbox) só escreve na sua pasta tmp, por isso converte-se lá e copia-se de volta."""
    tmp = os.path.expanduser("~/Library/Containers/com.microsoft.Word/Data/tmp")
    if not os.path.isdir("/Applications/Microsoft Word.app"):
        return
    os.makedirs(tmp, exist_ok=True)
    src, out = os.path.join(tmp, "contrato_auto.docx"), os.path.join(tmp, "contrato_auto.pdf")
    for f in (src, out):
        if os.path.exists(f):
            os.remove(f)
    shutil.copy2(docx, src)
    script = f'''tell application "Microsoft Word"
  open file name (POSIX file "{src}" as text)
  delay 2
  save as active document file name (POSIX file "{out}" as text) file format format PDF
  close active document saving no
end tell'''
    subprocess.run(["osascript", "-e", script], capture_output=True, timeout=120)
    if os.path.exists(out):
        shutil.copy2(out, os.path.splitext(docx)[0] + ".pdf")


def _masculino(path: str):
    import zipfile
    zin = zipfile.ZipFile(path)
    xml = zin.read("word/document.xml").decode("utf-8")
    for f, m in FEM_PARA_MASC:
        xml, _ = replace_all(xml, f, m)
    items = [(it, zin.read(it.filename)) for it in zin.infolist()]
    zin.close()
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for it, d in items:
            z.writestr(it, xml.encode("utf-8") if it.filename == "word/document.xml" else d)


def main():
    if not os.path.isdir(CLIENTES):
        raise SystemExit(f"OneDrive não encontrado: {CLIENTES}")
    for o in pendentes():
        nome = (o.get("answers") or {}).get("nome") or o.get("lead_nome") or o["id"]
        try:
            ficheiro, erro = preparar(o)
        except Exception as e:  # noqa: BLE001
            ficheiro, erro = None, f"Erro: {e}"
        stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
        if erro:
            marcar_erro(o["id"], erro, o.get("contrato_erro"))
            print(f"{stamp} {nome}: {erro}")
        else:
            marcar_ok(o["id"], ficheiro, nome)
            print(f"{stamp} {nome}: contrato em {ficheiro}")


if __name__ == "__main__":
    main()
