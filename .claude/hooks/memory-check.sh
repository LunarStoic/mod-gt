#!/usr/bin/env bash
# Stop hook: ingatkan agent memperbarui docs/AGENT_MEMORY.md jika ada perubahan
# file yang lebih baru daripada memori. Hanya memakai git + bash. Tidak menjalankan
# kode proyek. Fail-open: error apa pun -> izinkan berhenti (exit 0).

MEM="docs/AGENT_MEMORY.md"
input="$(cat 2>/dev/null)"

# Cegah loop: jika Claude sudah lanjut karena hook ini, izinkan berhenti.
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

if [ ! -f "$MEM" ]; then
  echo "docs/AGENT_MEMORY.md tidak ditemukan. Buat/pulihkan file memori proyek sesuai CLAUDE.md sebelum selesai." >&2
  exit 2
fi

stale=""
while IFS= read -r -d '' entry; do
  f="${entry:3}"                       # buang prefix status "XY "
  [ "$f" = "$MEM" ] && continue
  [ -f "$f" ] || continue              # lewati file terhapus / entri rename lama
  if [ "$f" -nt "$MEM" ]; then
    stale="$stale $f"
  fi
done < <(git status --porcelain -z -uall 2>/dev/null)

if [ -n "$stale" ]; then
  echo "Memori proyek belum mencerminkan perubahan terbaru:${stale}. Perbarui docs/AGENT_MEMORY.md (tanggal, permintaan, tindakan, hasil, keputusan, status tugas; tanpa kredensial) lalu selesaikan respons. Jika perubahan tersebut sudah dicatat atau tidak penting, cukup tambahkan satu baris di Work Log." >&2
  exit 2
fi
exit 0
