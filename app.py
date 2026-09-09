#!/usr/bin/env python3
"""
app.py
Flask server for Florida Keys Bachelor Party Mobile Companion App.
Binds to 0.0.0.0:5050 for local Wi-Fi and phone access.
"""

import os
import socket
from datetime import datetime
from flask import Flask, jsonify, send_from_directory, request
from planner_parser import PlannerParser, DEFAULT_SPREADSHEET_PATH

app = Flask(__name__, static_folder="static", static_url_path="")
parser = PlannerParser()

def get_lan_ip():
    """Finds the best LAN IP for mobile devices on the local Wi-Fi."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "192.168.51.246"

PORT = int(os.environ.get("PORT", 5050))
LAN_IP = get_lan_ip()
LAN_URL = f"http://{LAN_IP}:{PORT}"

@app.after_request
def add_header(response):
    # Prevent aggressive mobile browser caching for API calls
    if request.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/sw.js")
def serve_sw():
    response = send_from_directory(app.static_folder, "sw.js")
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

@app.route("/api/data", methods=["GET"])
def get_trip_data():
    try:
        data = parser.get_data(force_refresh=False)
        return jsonify({
            "success": True,
            "data": data,
            "lan_url": LAN_URL
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/refresh", methods=["POST", "GET"])
def force_refresh_data():
    try:
        data = parser.get_data(force_refresh=True)
        return jsonify({
            "success": True,
            "refreshed_at": datetime.now().isoformat(),
            "data": data,
            "lan_url": LAN_URL
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/info", methods=["GET"])
def get_server_info():
    mtime = None
    if os.path.exists(DEFAULT_SPREADSHEET_PATH):
        mtime = datetime.fromtimestamp(os.path.getmtime(DEFAULT_SPREADSHEET_PATH)).isoformat()
    return jsonify({
        "status": "online",
        "port": PORT,
        "lan_ip": LAN_IP,
        "lan_url": LAN_URL,
        "local_url": f"http://localhost:{PORT}",
        "spreadsheet_path": DEFAULT_SPREADSHEET_PATH,
        "spreadsheet_mtime": mtime
    })

if __name__ == "__main__":
    print("=" * 65)
    print("🌴 FLORIDA KEYS BACHELOR PARTY COMPANION APP 🌴")
    print(f"📱 Phone Access URL (Connect to Wi-Fi): {LAN_URL}")
    print(f"💻 Local Computer URL:                http://localhost:{PORT}")
    print(f"📊 Live Spreadsheet:                 {DEFAULT_SPREADSHEET_PATH}")
    print("=" * 65)
    app.run(host="0.0.0.0", port=PORT, debug=False)
