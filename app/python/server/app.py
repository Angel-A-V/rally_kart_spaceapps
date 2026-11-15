"""The backend: a small Flask server (Decision A in docs/software-architecture.md).

Routes (all answers JSON):
  GET /api/health                 is the server up, and which terrain maps are downloaded
  GET /api/custom?lat=..&lon=..   analyse any point on the Moon (server/custom_point.py)

It also serves the built website (app/dist/) when that exists, so on the Arduino UNO Q one
command runs everything. During development, Vite serves the page and forwards /api here
(see app/vite.config.js).

Run (from the repo root):
  .venv/bin/python app/python/server/app.py              http://127.0.0.1:8000
  HOST=0.0.0.0 PORT=8000 python3 app/python/server/app.py   reachable from other devices (UNO Q)

Port 8000, not Flask's usual 5000: macOS uses 5000 for AirPlay.
"""
import os
import sys
import urllib.error

from flask import Flask, jsonify, request, send_from_directory

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # app/python

from server import custom_point  # noqa: E402

APP_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # app
DIST = os.path.join(APP_DIR, "dist")


def create_app(build=None):
    """Make the Flask app. `build` replaces custom_point.cached_build in tests (no network)."""
    build = build or custom_point.cached_build
    app = Flask(__name__, static_folder=None)

    @app.get("/api/health")
    def health():
        band, wide, whole = custom_point._terrain_files_present()
        return jsonify(ok=True, terrain={"85S_20M": band, "80S_40M": wide, "LDEM_128": whole})

    @app.get("/api/custom")
    def custom():
        lat, lon = request.args.get("lat"), request.args.get("lon")
        if lat is None or lon is None:
            return jsonify(error="give both lat and lon, e.g. /api/custom?lat=-89.5&lon=200"), 400
        try:
            return jsonify(build(lat, lon))
        except custom_point.BadInput as e:
            return jsonify(error=str(e)), 400
        except (urllib.error.URLError, TimeoutError, RuntimeError) as e:
            # URLError covers no internet and HTTP errors; RuntimeError covers Horizons' own error replies.
            app.logger.warning("Horizons request failed: %s", e)
            return jsonify(error="NASA JPL Horizons could not be reached or refused the request. "
                                 "Check the internet connection and try again.",
                           detail=str(e)), 502

    # The built website, for hardware mode (UNO Q). Not used while `npm run dev` is running.
    @app.get("/")
    @app.get("/<path:path>")
    def site(path="index.html"):
        if not os.path.isdir(DIST):
            return ("The website is not built. Run `npm run build` in app/, "
                    "or use `npm run dev` during development."), 404
        if not os.path.isfile(os.path.join(DIST, path)):
            path = "index.html"
        return send_from_directory(DIST, path)

    return app


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    create_app().run(host=host, port=port, threaded=True)
