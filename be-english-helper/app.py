import subprocess
import tempfile
import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import shutil


app = Flask(__name__)
CORS(app)

SAVE_DIR = "transcripts"
os.makedirs(SAVE_DIR, exist_ok=True)


def parse_vtt_to_json(vtt_content: str):
    results = []
    start = end = None
    buf = []
    for raw in vtt_content.splitlines():
        line = raw.strip()
        if not line:
            if start and end and buf:
                text = re.sub(r"<[^>]+>", "", " ".join(buf)).strip()
                if text:
                    results.append({"start": start, "end": end, "text": text})
            start = end = None
            buf = []
            continue
        if "-->" in line:
            t1, t2 = [s.strip() for s in line.split("-->")]
            start, end = t1, t2
        elif line.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        else:
            buf.append(line)
    if start and end and buf:
        text = re.sub(r"<[^>]+>", "", " ".join(buf)).strip()
        if text:
            results.append({"start": start, "end": end, "text": text})
    return results


@app.route("/download", methods=["GET"])
def download_sub():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Missing YouTube URL"}), 400
    try:
        tmpdir = tempfile.mkdtemp()
        cmd = [
            "python", "-m", "yt_dlp",
            "--write-auto-sub",
            "--sub-lang", "en",
            "--skip-download",
            "-o", os.path.join(tmpdir, "%(id)s.%(ext)s"),
            url
        ]
        subprocess.run(cmd, check=True)

        vtt_file = next((os.path.join(tmpdir, f)
                        for f in os.listdir(tmpdir) if f.endswith(".vtt")), None)
        if not vtt_file:
            return jsonify({"error": "Transcript not found"}), 404

        # copy file raw vào SAVE_DIR để giữ lại
        video_id = os.path.splitext(os.path.basename(vtt_file))[0]
        saved_path = os.path.join(SAVE_DIR, f"{video_id}.vtt")
        shutil.copy(vtt_file, saved_path)

        # đọc nội dung raw để parse
        with open(vtt_file, "r", encoding="utf-8") as f:
            raw_content = f.read()

        sentences = parse_vtt_to_json(raw_content)

        return jsonify({
            "success": True,
            "sentences": sentences,
            "raw_file": saved_path  # trả về path để bạn biết chỗ lưu
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
