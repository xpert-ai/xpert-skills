"""Local protocol fixture only. This does not accept any business plugin."""
import importlib.util
import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("acceptance", Path(__file__).with_name("plugin-acceptance.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProtocolTest(unittest.TestCase):
    def setUp(self):
        self.requests = []
        requests = self.requests

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                raw = self.rfile.read(int(self.headers["Content-Length"]))
                body = {} if self.path.endswith("archive") else json.loads(raw)
                requests.append((self.path, dict(self.headers), body))
                connection = {"endpoint": f"http://127.0.0.1:{self.server.server_port}/api/mcp/p/probe", "protocolVersion": "2026-07-28"}
                if self.path.startswith("/api/mcp/") and (
                    self.headers.get("Organization-Id") != "org" or self.headers.get("Tenant-Id") != "tenant"
                ):
                    self.send_response(400)
                    self.end_headers()
                    return
                if self.path.endswith("archive"):
                    self.assert_upload = b'name="file"' in raw
                    result = {"restartRequired": True}
                elif self.path.endswith("by-names"):
                    result = [{"name": "@fixture/probe", "runningVersion": "1.0.0", "loadStatus": "loaded"}]
                elif self.path.endswith("enable"):
                    result = {"publication": {"id": "publication"}, "createdApiKey": {"secret": "not-logged"}}
                elif self.path.endswith("credential"):
                    result = {"secret": "fixture-mcp-secret", "connectionInfo": connection}
                elif body["method"] == "notifications/initialized":
                    self.send_response(202)
                    self.end_headers()
                    return
                else:
                    self.assert_session = self.headers.get("Mcp-Session-Id")
                    if body["method"] == "initialize" and self.headers.get("MCP-Protocol-Version") == "2026-07-28":
                        self.send_response(400)
                        self.end_headers()
                        return
                    values = {"initialize": {"protocolVersion": self.server.negotiated_protocol},
                              "tools/list": {"tools": [{"name": "fixture_probe"}]},
                              "tools/call": {"structuredContent": {"ok": True}, "isError": False}}
                    result = {"jsonrpc": "2.0", "id": body["id"], "result": values[body["method"]]}
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream")
                    self.send_header("Mcp-Session-Id", "fixture-session")
                    self.end_headers()
                    self.wfile.write(("event: message\ndata: " + json.dumps(result) + "\n\n").encode())
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())

            def do_DELETE(self):
                requests.append((self.path, dict(self.headers), {"method": "delete"}))
                self.send_response(204)
                self.end_headers()

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.negotiated_protocol = "2025-03-26"
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.env = patch.dict(os.environ, {"XPERT_API_URL": f"http://127.0.0.1:{self.server.server_port}",
                              "XPERT_TOKEN": "fixture-admin-secret", "XPERT_TENANT_ID": "tenant", "XPERT_ORG_ID": "org"})
        self.env.start()
        self.directory = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.env.stop()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.directory.cleanup()

    def test_real_http_sse_session_and_feature_assertions(self):
        cases = Path(self.directory.name) / "cases.json"
        cases.write_text(json.dumps([{"name": "fixture_probe", "arguments": {},
                                    "expect": {"result": {"structuredContent": {"ok": True}, "isError": False}}}]))
        client = module.Client("organization")
        result = module.verify(client, SimpleNamespace(plugin="@fixture/probe", component="tools", cases=cases))
        self.assertTrue(result["casesPassed"])
        self.assertFalse(result["acceptancePassed"])
        rpc_calls = [r for r in self.requests if r[0].startswith("/api/mcp/")]
        self.assertTrue(all(r[1]["Authorization"] == "Bearer fixture-mcp-secret" for r in rpc_calls))
        self.assertTrue(all({k.lower(): v for k, v in r[1].items()}.get("organization-id") == "org" for r in rpc_calls))
        self.assertTrue(all({k.lower(): v for k, v in r[1].items()}.get("tenant-id") == "tenant" for r in rpc_calls))
        self.assertTrue(all(any(k.lower() == "mcp-session-id" for k in r[1]) for r in rpc_calls[1:]))
        self.assertNotIn("mcp-protocol-version", {k.lower() for k in rpc_calls[0][1]})
        self.assertEqual(rpc_calls[0][2]["params"]["protocolVersion"], "2025-11-25")
        self.assertTrue(all({k.lower(): v for k, v in r[1].items()}.get("mcp-protocol-version") == "2025-03-26"
                            for r in rpc_calls[1:]))
        self.assertEqual(result["protocol"], {"mode": "legacy", "advertised": "2026-07-28",
                                            "requested": "2025-11-25", "negotiated": "2025-03-26"})
        self.assertNotIn("fixture-mcp-secret", json.dumps(module.scrub(result, client.secrets)))

    def test_unsupported_negotiated_protocol_stops_before_business_calls(self):
        self.server.negotiated_protocol = "2026-07-28"
        cases = Path(self.directory.name) / "cases.json"
        cases.write_text(json.dumps([{"name": "fixture_probe", "arguments": {},
                                    "expect": {"result": {"structuredContent": {"ok": True}}}}]))
        with self.assertRaisesRegex(module.Failure, "supported legacy MCP version"):
            module.verify(module.Client("organization"), SimpleNamespace(plugin="@fixture/probe", component="tools", cases=cases))
        self.assertFalse(any(r[2].get("method") == "tools/call" for r in self.requests))

    def test_cli_preserves_malformed_unicode_arguments_in_utf8_receipt(self):
        cases = Path(self.directory.name) / "cases.json"
        evidence = Path(self.directory.name) / "receipt.json"
        arguments = {"invalidUnicode": "\ud800"}
        cases.write_text(json.dumps([{"name": "fixture_probe", "arguments": arguments,
                                    "expect": {"result": {"structuredContent": {"ok": True}}}}]))
        with patch("sys.argv", ["plugin-acceptance.py", "--scope", "organization", "verify",
                               "--plugin", "@fixture/probe", "--component", "tools",
                               "--cases", str(cases), "--evidence", str(evidence)]), redirect_stdout(io.StringIO()):
            self.assertEqual(module.main(), 0)
        saved = json.loads(evidence.read_bytes().decode("utf-8"))
        self.assertEqual(saved["cases"][0]["arguments"], arguments)
        self.assertFalse(saved["acceptancePassed"])
        self.assertEqual(evidence.stat().st_mode & 0o077, 0)

    def test_archive_digest_fails_before_network(self):
        archive = Path(self.directory.name) / "probe.tgz"
        archive.write_bytes(b"fixture archive")
        with self.assertRaises(module.Failure):
            module.install(module.Client("tenant"), SimpleNamespace(archive=archive, sha256="wrong"))
        self.assertEqual(self.requests, [])
        self.assertNotIn("organization-id", module.Client("tenant").headers)

    def test_empty_or_ambiguous_expectations_fail_before_network(self):
        cases = Path(self.directory.name) / "cases.json"
        for expected in [None, {}, {"result": {}}, {"error": {}}, {"result": None},
                         {"result": {"isError": False}, "error": {"code": -32602}}]:
            with self.subTest(expected=expected):
                cases.write_text(json.dumps([{"name": "fixture_probe", "arguments": {}, "expect": expected}]))
                with self.assertRaisesRegex(module.Failure, "exactly one nonempty"):
                    module.verify(module.Client("organization"), SimpleNamespace(
                        plugin="@fixture/probe", component="tools", cases=cases))
                self.assertEqual(self.requests, [])

    def test_wrong_business_expectation_is_failed_not_accepted(self):
        cases = Path(self.directory.name) / "cases.json"
        cases.write_text(json.dumps([{"name": "fixture_probe", "arguments": {},
                                    "expect": {"result": {"structuredContent": {"ok": False}}}}]))
        result = module.verify(module.Client("organization"), SimpleNamespace(plugin="@fixture/probe", component="tools", cases=cases))
        self.assertFalse(result["casesPassed"])
        self.assertFalse(result["acceptancePassed"])

    def test_exact_archive_upload_retains_digest_and_restart_requirement(self):
        archive = Path(self.directory.name) / "probe.tgz"
        archive.write_bytes(b"fixture archive")
        digest = module.hashlib.sha256(archive.read_bytes()).hexdigest()
        result = module.install(module.Client("tenant"), SimpleNamespace(archive=archive, sha256=digest))
        self.assertEqual(result["sha256"], digest)
        self.assertTrue(result["receipt"]["restartRequired"])
        self.assertFalse(result["acceptancePassed"])

    def test_assertions_are_type_sensitive_and_credentials_are_redacted(self):
        self.assertFalse(module.matches({"ok": 1}, {"ok": True}))
        self.assertFalse(module.matches({"items": [1, 2]}, {"items": [1]}))
        self.assertTrue(module.matches({"ok": True, "extra": 1}, {"ok": True}))
        self.assertEqual(module.scrub({"secret": "s", "text": "Bearer private"}, ["private"]),
                         {"secret": "<redacted>", "text": "Bearer <redacted>"})

    def test_cross_origin_and_userinfo_are_not_equivalent(self):
        self.assertNotEqual(module.origin("http://localhost:3001"), module.origin("http://localhost:3000"))
        self.assertEqual(module.origin("http://localhost:3001"), module.origin("http://127.0.0.1:3001"))
        with self.assertRaises(module.Failure):
            module.origin("http://user:pass@localhost")


if __name__ == "__main__":
    unittest.main()
