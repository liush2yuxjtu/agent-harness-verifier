#!/usr/bin/env bash
# verify.sh — static + proxy checks for coding-agent harnesses. Portable:
# works on any macOS/Linux machine. Standard harnesses are checked generically;
# custom/local setups (claudex proxy, custom wrappers like openclaude) are checked
# ONLY if their files exist. Never prints secret values — only validity and modes.
set -uo pipefail

H="$HOME"; C="$H/.claude"; BIN="$H/.local/bin"
declare -a FAIL=(); P_COUNT=0
say(){ printf '%s\n' "$*"; }
ok(){ printf '  [PASS] %s\n' "$*"; P_COUNT=$((P_COUNT+1)); }
bad(){ printf '  [FAIL] %s\n' "$*"; FAIL+=("$*"); }

mode_of(){ stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1"; }

json_ok(){ # $1 path $2 label
  [ -f "$1" ] || { bad "$2 missing: $1"; return; }
  python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$1" 2>/dev/null \
    && ok "$2 valid: $1" || bad "$2 INVALID: $1"
}
yaml_ok(){ # $1 path $2 label
  [ -f "$1" ] || { bad "$2 missing: $1"; return; }
  python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' "$1" 2>/dev/null \
    && ok "$2 valid: $1" || bad "$2 INVALID: $1"
}
toml_ok(){ # $1 path $2 label — tomllib (3.11+) → tomli → node js-toml → soft
  [ -f "$1" ] || { bad "$2 missing: $1"; return; }
  if python3 -c 'import tomllib' 2>/dev/null; then
    python3 -c 'import tomllib,sys; tomllib.load(open(sys.argv[1],"rb"))' "$1" 2>/dev/null \
      && ok "$2 valid: $1" || bad "$2 INVALID: $1"
  elif python3 -c 'import tomli' 2>/dev/null; then
    python3 -c 'import tomli,sys; tomli.load(open(sys.argv[1],"rb"))' "$1" 2>/dev/null \
      && ok "$2 valid: $1" || bad "$2 INVALID: $1"
  elif [ -d "$H/.config/opencode/node_modules/toml" ]; then
    node -e 'const t=require(process.argv[1]),fs=require("fs");try{t.parse(fs.readFileSync(process.argv[2],"utf8"));process.exit(0)}catch(e){process.exit(1)}' \
      "$H/.config/opencode/node_modules/toml" "$1" 2>/dev/null \
      && ok "$2 valid: $1" || bad "$2 INVALID: $1"
  else
    [ -s "$1" ] && ok "$2 non-empty (no TOML parser available)" || bad "$2 empty: $1"
  fi
}
jsonc_ok(){ # $1 path $2 label — strip // and /* */ comments, then parse
  [ -f "$1" ] || { bad "$2 missing: $1"; return; }
  python3 - "$1" <<'PY' 2>/dev/null && ok "$2 valid: $1" || bad "$2 INVALID: $1"
import json, re, sys
raw = open(sys.argv[1]).read()
raw = re.sub(r'/\*.*?\*/', '', raw, flags=re.S)
raw = re.sub(r'(?m)^\s*//.*$', '', raw)
json.loads(raw)
PY
}
mode_check(){ # $1 path $2 label $3 wanted-mode
  [ -f "$1" ] || { bad "$2 missing: $1"; return; }
  m=$(mode_of "$1")
  [[ "$m" == "$3" ]] && ok "$2 mode $m" || bad "$2 mode $m (want $3)"
}
# informational only — print the configured model so TUI comparison is possible
report_model(){
  [ -f "$1" ] || return
  local m
  m=$(grep -oE '"(model|Model)"[[:space:]]*:[[:space:]]*"[^"]+"' "$1" 2>/dev/null | head -1)
  [ -z "$m" ] && m=$(grep -E '^model[[:space:]]*=' "$1" 2>/dev/null | head -1 | tr -d ' ')
  [ -n "$m" ] && say "  $2 -> $m"
}

# ================= standard: claude code =================
say "== claude code =="
if [ -d "$C" ]; then
  json_ok "$C/settings.json"          "claude settings"
  [ -f "$C/settings.local.json" ] && json_ok "$C/settings.local.json" "claude local settings"
  report_model "$C/settings.json" "claude configured model"
else
  say "  (not installed, skipping)"
fi

# ================= standard: codex =================
say "== codex =="
if [ -d "$H/.codex" ]; then
  toml_ok "$H/.codex/config.toml" "codex config"
  json_ok "$H/.codex/auth.json"   "codex auth"
  mode_check "$H/.codex/auth.json" "codex auth" 600
  [ -f "$H/.codex/hooks.json" ] && json_ok "$H/.codex/hooks.json" "codex hooks"
  report_model "$H/.codex/config.toml" "codex configured model"
else
  say "  (not installed, skipping)"
fi

# ================= standard: pi =================
say "== pi =="
if [ -d "$H/.pi" ]; then
  json_ok "$H/.pi/agent/settings.json" "pi settings"
  [ -f "$H/.pi/agent/auth.json" ] && mode_check "$H/.pi/agent/auth.json" "pi auth" 600
  json_ok "$H/.pi/agent/trust.json" "pi trust"
else
  say "  (not installed, skipping)"
fi

# ================= standard: opencode =================
say "== opencode =="
if [ -d "$H/.config/opencode" ]; then
  jsonc_ok "$H/.config/opencode/opencode.jsonc" "opencode config"
  [ -f "$H/.config/opencode/tui.json" ] && json_ok "$H/.config/opencode/tui.json" "opencode tui"
  report_model "$H/.config/opencode/opencode.jsonc" "opencode configured model"
else
  say "  (not installed, skipping)"
fi

# ================= generic secret hygiene =================
say "== secret file hygiene =="
for f in "$H/.codex/auth.json" "$H/.pi/agent/auth.json" "$H/.claude/.credentials"* ; do
  [ -f "$f" ] && mode_check "$f" "$(basename "$f")" 600
done

# ================= custom/local setup (only if present) =================
# e.g. a shared local proxy (claudex) + a custom wrapper (openclaude) that pins a
# text-only model. Everything below is skipped on machines without these files —
# add your own local setup here.
if [ -d "$H/.config/claudex" ] || [ -x "$BIN/openclaude-run" ]; then
  CLD="$H/.config/claudex"
  say "== custom/local setup (claudex + custom wrapper) =="
  if [ -f "$CLD/env" ]; then
    mode_check "$CLD/env" "proxy env" 600
    [[ -O "$CLD/env" ]] && ok "proxy env owned by user" || bad "proxy env NOT owned by user"
    for v in CLAUDEX_PROXY_BASE_URL CLAUDEX_PROXY_BIN CLAUDEX_PROXY_CONFIG_FILE CLAUDEX_PROXY_LOG_DIR; do
      grep -q "^$v=" "$CLD/env" && ok "proxy env $v" || bad "proxy env $v missing"
    done
  fi
  [ -f "$CLD/cli-proxy-api.yaml" ] && yaml_ok "$CLD/cli-proxy-api.yaml" "proxy routing"
  [ -f "$CLD/openclaude-settings.json" ] && json_ok "$CLD/openclaude-settings.json" "openclaude settings"
  if [ -x "$BIN/openclaude-run" ]; then
    grep -q 'export CLAUDE_AGENT_ID=' "$BIN/openclaude-run" 2>/dev/null \
      && ok "wrapper scoping marker present" || bad "wrapper scoping marker missing"
    grep -q 'ANTHROPIC_MODEL=' "$BIN/openclaude-run" 2>/dev/null \
      && ok "wrapper pins ANTHROPIC_MODEL" || bad "wrapper model pin missing"
    report_model "$BIN/openclaude-run" "wrapper pinned model"
  fi
  # proxy health
  BASE_URL=""
  [ -f "$CLD/env" ] && BASE_URL=$(grep '^CLAUDEX_PROXY_BASE_URL=' "$CLD/env" | cut -d'"' -f2)
  if [ -n "$BASE_URL" ]; then
    curl --noproxy '*' -sf --max-time 2 "${BASE_URL%/}/healthz" >/dev/null 2>&1 \
      && ok "proxy healthz OK: ${BASE_URL%/}/healthz" || bad "proxy healthz DOWN: ${BASE_URL%/}/healthz"
    port="${BASE_URL##*:}"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 \
      && ok "proxy port $port listening" || bad "proxy port $port NOT listening"
    [ -f "$CLD/proxy.pid" ] && { pid=$(cat "$CLD/proxy.pid"); kill -0 "$pid" 2>/dev/null \
      && ok "proxy pid $pid alive" || bad "proxy.pid stale: $pid"; }
  fi
fi

# ================= hooks referenced in settings exist =================
say "== claude hooks =="
python3 - "$C/settings.json" "$H/.config/claudex/openclaude-settings.json" <<'PY' 2>/dev/null || true
import json, os, sys
for path in sys.argv[1:]:
    if not os.path.exists(path): continue
    try: data = json.load(open(path))
    except Exception: continue
    for evt, blocks in data.get("hooks", {}).items():
        for b in blocks:
            for h in b.get("hooks", []):
                p = h.get("command", "").split()
                if p and p[0] in ("bash","node","python3","sh") and len(p) > 1:
                    full = os.path.expanduser(p[1].strip("'\""))
                    if full.startswith("/") and not os.path.exists(full):
                        print(f"  [FAIL] hook ref missing: {full}  (from {path})")
PY

say ""
if [ ${#FAIL[@]} -eq 0 ]; then
  say "RESULT: ALL PASS ($P_COUNT checks)"
else
  say "RESULT: ${#FAIL[@]} FAILURE(S)"
  for f in "${FAIL[@]}"; do say "  - $f"; done
fi
exit $(( ${#FAIL[@]} > 0 ? 1 : 0 ))
