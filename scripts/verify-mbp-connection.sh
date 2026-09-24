#!/usr/bin/env bash
# Verify Mac mini -> MacBook Pro connectivity through the configured SSH/Tailscale path.
# Read-only: does not change SSH, Tailscale, or remote files.
set -uo pipefail

HOST_ALIAS="${MBP_SSH_HOST:-mbp}"
CONNECT_TIMEOUT="${MBP_CONNECT_TIMEOUT:-10}"
EXPECTED_HOSTNAME="${MBP_EXPECTED_HOSTNAME:-}"
FAIL=0

pass(){ printf '  [PASS] %s\n' "$*"; }
fail(){ printf '  [FAIL] %s\n' "$*"; FAIL=1; }
info(){ printf '  [INFO] %s\n' "$*"; }

command -v ssh >/dev/null 2>&1 || { fail "ssh is not installed"; exit 1; }
command -v ssh-keygen >/dev/null 2>&1 || { fail "ssh-keygen is not installed"; exit 1; }

SSH_CONFIG="$(ssh -G "$HOST_ALIAS" 2>/dev/null || true)"
if [ -z "$SSH_CONFIG" ]; then
  fail "SSH host alias is not resolvable: $HOST_ALIAS"
  exit 1
fi

CONFIG_HOST="$(printf '%s\n' "$SSH_CONFIG" | awk '$1=="hostname"{print $2; exit}')"
CONFIG_USER="$(printf '%s\n' "$SSH_CONFIG" | awk '$1=="user"{print $2; exit}')"
CONFIG_PORT="$(printf '%s\n' "$SSH_CONFIG" | awk '$1=="port"{print $2; exit}')"
[ -n "$CONFIG_HOST" ] && info "SSH $HOST_ALIAS -> $CONFIG_HOST"
[ -n "$CONFIG_USER" ] && info "SSH user: $CONFIG_USER"
[ -n "$CONFIG_PORT" ] && info "SSH port: $CONFIG_PORT"

if command -v tailscale >/dev/null 2>&1; then
  TS_LINE="$(tailscale status 2>/dev/null | awk -v h="$CONFIG_HOST" '$1==h || $2==h {print; exit}')"
  if [ -n "$TS_LINE" ]; then
    pass "Tailscale peer is visible for $CONFIG_HOST"
  else
    info "Tailscale CLI is present but no exact peer row matched; SSH probe is authoritative"
  fi
else
  info "Tailscale CLI not installed; continuing with SSH probe"
fi

REMOTE_OUTPUT="$(ssh -o BatchMode=yes -o ConnectTimeout="$CONNECT_TIMEOUT" "$HOST_ALIAS" 'printf "hostname=%s\n" "$(hostname)"; printf "os=%s\n" "$(sw_vers -productVersion 2>/dev/null || uname -s)"; printf "user=%s\n" "$(id -un)' 2>&1)"
SSH_EXIT=$?
if [ "$SSH_EXIT" -ne 0 ]; then
  fail "SSH probe failed (exit=$SSH_EXIT)"
  printf '%s\n' "$REMOTE_OUTPUT" | tail -n 8
  exit "$FAIL"
fi

pass "SSH probe succeeded"
printf '%s\n' "$REMOTE_OUTPUT" | while IFS= read -r line; do
  case "$line" in
    hostname=*|os=*|user=*) info "$line" ;;
  esac
done

if [ -n "$EXPECTED_HOSTNAME" ]; then
  ACTUAL_HOSTNAME="$(printf '%s\n' "$REMOTE_OUTPUT" | awk -F= '$1=="hostname"{print $2; exit}')"
  [ "$ACTUAL_HOSTNAME" = "$EXPECTED_HOSTNAME" ]     && pass "Remote hostname matches MBP_EXPECTED_HOSTNAME"     || fail "Remote hostname mismatch (expected=$EXPECTED_HOSTNAME actual=$ACTUAL_HOSTNAME)"
fi

if [ "$FAIL" -eq 0 ]; then
  printf 'RESULT: ALL PASS\n'
else
  printf 'RESULT: FAILURE\n'
fi
exit "$FAIL"
