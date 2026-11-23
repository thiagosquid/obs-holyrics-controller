#!/usr/bin/env python3
"""Converte o subsystem do PE de console (3) para GUI (2).

Aplicado ao OHC.exe gerado pelo pkg para que o Windows não abra uma janela
de terminal ao iniciar o OHC. Uso:

    python3 scripts/patch-pe-gui.py caminho/para/OHC.exe

Idempotente e seguro: valida a assinatura PE antes de gravar e verifica o
resultado em seguida.
"""
import struct
import sys

SUBSYSTEM_GUI = 2
SUBSYSTEM_CONSOLE = 3


def main(path: str) -> int:
    with open(path, "r+b") as f:
        dos = f.read(0x40)
        if len(dos) < 0x40 or dos[:2] != b"MZ":
            print("ERRO: não é um executável PE (sem cabeçalho MZ)")
            return 1

        e_lfanew = struct.unpack_from("<I", dos, 0x3C)[0]
        f.seek(e_lfanew)
        if f.read(4) != b"PE\x00\x00":
            print("ERRO: assinatura PE inválida")
            return 1

        # COFF (20 bytes) + OptionalHeader; Subsystem em +68 no optional header
        off = e_lfanew + 24 + 68
        f.seek(off)
        (current,) = struct.unpack("<H", f.read(2))
        print(f"Subsystem atual: {current} "
              f"({'console' if current == SUBSYSTEM_CONSOLE else 'gui' if current == SUBSYSTEM_GUI else current})")

        if current == SUBSYSTEM_GUI:
            print("Já está em modo GUI; nada a fazer.")
            return 0

        f.seek(off)
        f.write(struct.pack("<H", SUBSYSTEM_GUI))

        # verificação
        f.seek(off)
        (check,) = struct.unpack("<H", f.read(2))
        if check == SUBSYSTEM_GUI:
            print("Patch aplicado: subsystem GUI (2). Sem janela de terminal ao iniciar.")
            return 0

        print("ERRO: verificação falhou")
        return 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1]))
