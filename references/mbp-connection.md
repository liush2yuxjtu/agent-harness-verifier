# MacBook Pro connection verification

This check validates the existing route:

`mcp-gateway → personalMacMiniShell → Mac mini → SSH Host mbp → Tailscale → MacBook Pro`

Run it on the Mac mini (or another machine that has the same SSH alias):

```bash
bash scripts/verify-mbp-connection.sh
```

Optional controls:

- `MBP_SSH_HOST`: SSH alias, default `mbp`
- `MBP_CONNECT_TIMEOUT`: SSH timeout in seconds, default `10`
- `MBP_EXPECTED_HOSTNAME`: optional exact remote hostname assertion

The verifier is read-only. It checks SSH alias resolution, reports a matching Tailscale peer when the CLI is available, and runs a non-mutating remote probe for hostname, OS, and user. It never prints private keys, tokens, or environment contents.

A successful result proves Mac mini → MBP connectivity only. It does not prove MBP → Mac mini reverse connectivity, a GitHub runner registration, or full agent-harness health.
