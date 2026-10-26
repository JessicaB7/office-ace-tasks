"""Troca 'a Segunda Outorgante' (forma base dos modelos) para a forma masculina, e vice-versa."""

FEM_PARA_MASC = [
    ("designada por Segunda Outorgante", "designado por Segundo Outorgante"),
    ("facultar à Segunda Outorgante", "facultar ao Segundo Outorgante"),
    ("pela Segunda Outorgante", "pelo Segundo Outorgante"),
    ("da Segunda Outorgante", "do Segundo Outorgante"),
    ("A Segunda Outorgante", "O Segundo Outorgante"),
    ("a Segunda Outorgante", "o Segundo Outorgante"),
    ("Segunda Outorgante", "Segundo Outorgante"),
]
MASC_PARA_FEM = [(m, f) for f, m in FEM_PARA_MASC]
# ordem: específicos primeiro
MASC_PARA_FEM = [
    ("designado por Segundo Outorgante", "designada por Segunda Outorgante"),
    ("facultar ao Segundo Outorgante", "facultar à Segunda Outorgante"),
    ("pelo Segundo Outorgante", "pela Segunda Outorgante"),
    ("do Segundo Outorgante", "da Segunda Outorgante"),
    ("O Segundo Outorgante", "A Segunda Outorgante"),
    ("o Segundo Outorgante", "a Segunda Outorgante"),
    ("Segundo Outorgante", "Segunda Outorgante"),
]
