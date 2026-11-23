#!/usr/bin/env python3
"""Archive installation and real native-MCP checks; feature cases belong to the caller."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

# This client implements the legacy Streamable HTTP handshake. A publication's
# advertised modern version does not change the client's supported wire format.
CLIENT_PROTOCOL_VERSIONS = ("2025-11-25", "2025-06-18", "2025-03-26")


class Failure(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Failure("Redirect refused; verify the selected development API origin")


def origin(url):
    value = urllib.parse.urlsplit(url)
    if value.scheme not in ("http", "https") or not value.hostname or value.username or value.password:
        raise Failure("Expected an HTTP(S) URL without credentials")
    host = "loopback" if value.hostname in ("localhost", "127.0.0.1", "::1") else value.hostname
    return value.scheme, host, value.port or (443 if value.scheme == "https" else 80)


def matches(actual, expected):
    """Object expectations are recursive subsets; arrays and scalar values are exact."""
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(k in actual and matches(actual[k], v) for k, v in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and len(actual) == len(expected) and all(map(lambda p: matches(*p), zip(actual, expected)))
    return type(actual) is type(expected) and actual == expected


def scrub(value, secrets):
    if isinstance(value, dict):
        return {k: "<redacted>" if re.search(r"token|secret|password|authorization|credential", k, re.I)
                else scrub(v, secrets) for k, v in value.items()}
    if isinstance(value, list):
        return [scrub(v, secrets) for v in value]
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "<redacted>")
        return value
    return value


class Client:
    def __init__(self, scope):
        self.api = os.environ["XPERT_API_URL"].rstrip("/")
        origin(self.api)
        if urllib.parse.urlsplit(self.api).path not in ("", "/"):
            raise Failure("XPERT_API_URL must be the API origin, without /api")
        self.token = os.environ["XPERT_TOKEN"]
        self.headers = {"Authorization": "Bearer " + self.token, "Accept": "application/json", "x-scope-level": scope}
        scoped_headers = [("XPERT_TENANT_ID", "tenant-id")]
        if scope == "organization":
            scoped_headers.append(("XPERT_ORG_ID", "organization-id"))
        for env, header in scoped_headers:
            if os.environ.get(env):
                self.headers[header] = os.environ[env]
        if scope == "organization" and not os.environ.get("XPERT_ORG_ID"):
            raise Failure("Organization scope requires XPERT_ORG_ID")
        if not os.environ.get("XPERT_TENANT_ID"):
            raise Failure("The selected scope requires XPERT_TENANT_ID")
        self.opener = urllib.request.build_opener(NoRedirect())
        self.secrets = [self.token]
        self.session = None
        self.sequence = 0

    def open(self, url, method, headers, data=None):
        try:
            return self.opener.open(urllib.request.Request(url, data=data, headers=headers, method=method), timeout=120)
        except urllib.error.HTTPError as error:
            raise Failure(f"{method} {urllib.parse.urlsplit(url).path}: HTTP {error.code}") from None
        except urllib.error.URLError:
            raise Failure("Development API connection failed") from None

    def api_call(self, path, body=None, raw=None, content_type="application/json"):
        data = raw if raw is not None else json.dumps(body or {}).encode()
        headers = {**self.headers, "Content-Type": content_type}
        with self.open(self.api + "/api/" + path, "POST", headers, data) as response:
            return json.load(response)

    def rpc(self, endpoint, secret, protocol, method, params=None, notification=False):
        self.sequence += 1
        message = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        if not notification:
            message["id"] = self.sequence
        headers = {**self.headers, "Authorization": "Bearer " + secret, "Content-Type": "application/json",
                   "Accept": "application/json, text/event-stream"}
        if method != "initialize":
            headers["MCP-Protocol-Version"] = protocol
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        with self.open(endpoint, "POST", headers, json.dumps(message).encode()) as response:
            self.session = response.headers.get("Mcp-Session-Id", self.session)
            if notification:
                return None
            if "text/event-stream" in response.headers.get("Content-Type", ""):
                data, size = [], 0
                for line in response:
                    size += len(line)
                    if size > 8 * 1024 * 1024:
                        raise Failure("MCP response exceeds receipt limit")
                    line = line.decode().rstrip("\r\n")
                    if line.startswith("data:"):
                        data.append(line[5:].lstrip())
                    elif not line and data:
                        candidate = json.loads("\n".join(data))
                        data = []
                        if candidate.get("id") == message["id"]:
                            return candidate
                raise Failure("MCP stream ended without the requested response")
            result = json.load(response)
            if result.get("id") != message["id"]:
                raise Failure("MCP response identity mismatch")
            return result


def install(client, args):
    archive = Path(args.archive)
    payload = archive.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != args.sha256:
        raise Failure("Archive digest differs from the implementation task's receipt")
    boundary = uuid.uuid4().hex
    filename = archive.name
    if any(c in filename for c in ('"', '\r', '\n')):
        raise Failure("Invalid archive filename")
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            'Content-Type: application/gzip\r\n\r\n').encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    receipt = client.api_call("plugin/archive", raw=body, content_type="multipart/form-data; boundary=" + boundary)
    return {"phase": "installed", "archive": filename, "sha256": digest, "receipt": receipt,
            "acceptancePassed": False, "next": "Honor restartRequired/pending_restart, then verify loaded version and live cases"}


def verify(client, args):
    cases = json.loads(Path(args.cases).read_text())
    if not isinstance(cases, list) or not cases:
        raise Failure("Supply at least one feature-specific case")
    for case in cases:
        if not isinstance(case, dict) or not isinstance(case.get("name"), str) or not isinstance(case.get("arguments"), dict):
            raise Failure("Each case needs a tool name and arguments object")
        expect = case.get("expect")
        branches = set(expect) & {"result", "error"} if isinstance(expect, dict) else set()
        payload = expect[next(iter(branches))] if len(branches) == 1 else None
        # Empty subset objects match any payload; require an actual response assertion
        # before enabling a publication or acquiring its test credential.
        if not isinstance(payload, dict) or not payload:
            raise Failure("Each case needs exactly one nonempty expected JSON-RPC result or error object")
    descriptors = client.api_call("plugin/by-names", {"names": [args.plugin]})
    # Preserve the host descriptor for the Agent to inspect; do not equate install with load.
    base = "plugin/" + urllib.parse.quote(args.plugin, safe="") + "/resources/mcp/" + urllib.parse.quote(args.component, safe="")
    enabled = client.api_call(base + "/enable")
    credential = client.api_call(base + "/credential")
    secret = credential["secret"]
    client.secrets.append(secret)
    connection = credential["connectionInfo"]
    endpoint = connection["endpoint"]
    protocol = CLIENT_PROTOCOL_VERSIONS[0]
    if origin(endpoint) != origin(client.api):
        raise Failure("MCP endpoint origin differs from the selected API; correct the instance's public API URL")
    init = client.rpc(endpoint, secret, protocol, "initialize", {
        "protocolVersion": protocol, "capabilities": {}, "clientInfo": {"name": "xpert-plugin-acceptance", "version": "1.0.0"}
    })
    if "error" in init:
        raise Failure("MCP initialization rejected")
    protocol = init["result"]["protocolVersion"]
    if protocol not in CLIENT_PROTOCOL_VERSIONS:
        raise Failure("Server did not negotiate a supported legacy MCP version; a different client transport is required")
    client.rpc(endpoint, secret, protocol, "notifications/initialized", notification=True)
    tools = client.rpc(endpoint, secret, protocol, "tools/list")
    available = {tool["name"] for tool in tools.get("result", {}).get("tools", [])}
    results = []
    for case in cases:
        if case["name"] not in available:
            results.append({"name": case["name"], "passed": False, "reason": "Tool absent from live discovery"})
            continue
        actual = client.rpc(endpoint, secret, protocol, "tools/call", {"name": case["name"], "arguments": case["arguments"]})
        results.append({"name": case["name"], "arguments": case["arguments"], "expected": case["expect"],
                        "actual": actual, "passed": matches(actual, case["expect"])})
    if client.session:
        try:
            with client.open(endpoint, "DELETE", {**client.headers, "Authorization": "Bearer " + secret,
                             "Mcp-Session-Id": client.session, "MCP-Protocol-Version": protocol}):
                pass
        except Failure:
            pass
    return {"phase": "live-cases", "plugin": args.plugin, "component": args.component,
            "descriptors": descriptors, "publicationId": enabled["publication"]["id"], "endpoint": endpoint,
            "protocol": {"mode": "legacy", "advertised": connection["protocolVersion"],
                         "requested": CLIENT_PROTOCOL_VERSIONS[0], "negotiated": protocol},
            "initialize": init, "tools": tools, "cases": results, "casesPassed": all(c["passed"] for c in results),
            "acceptancePassed": False, "next": "Agent must review loaded version, archive identity and completeness of feature cases"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("organization", "tenant"), default="organization")
    commands = parser.add_subparsers(dest="command", required=True)
    upload = commands.add_parser("install")
    upload.add_argument("--archive", required=True)
    upload.add_argument("--sha256", required=True)
    live = commands.add_parser("verify")
    live.add_argument("--plugin", required=True)
    live.add_argument("--component", required=True)
    live.add_argument("--cases", required=True)
    for command in (upload, live):
        command.add_argument("--evidence", required=True)
    args = parser.parse_args()
    client = None
    try:
        client = Client(args.scope)
        result = install(client, args) if args.command == "install" else verify(client, args)
        result = scrub(result, client.secrets)
        output = Path(args.evidence)
        output.parent.mkdir(parents=True, exist_ok=True)
        with os.fdopen(os.open(output, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600), "w") as stream:
            # Preserve even malformed-Unicode test inputs as valid UTF-8 JSON receipts.
            json.dump(result, stream, indent=2, ensure_ascii=True)
            stream.write("\n")
        print(json.dumps({"evidence": str(output), "phase": result["phase"], "casesPassed": result.get("casesPassed")}))
        return 0 if result.get("casesPassed", True) else 1
    except (Failure, KeyError, ValueError, OSError) as error:
        # API bodies and credentials never enter error output.
        print(json.dumps({"error": str(error) if isinstance(error, Failure) else type(error).__name__}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
