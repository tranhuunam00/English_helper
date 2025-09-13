import { useState, useRef } from "react";
import YouTube from "react-youtube";

function tsOnly(str) {
  const m = (str || "").replace(",", ".").match(/\d{2}:\d{2}:\d{2}\.\d{3}/);
  return m ? m[0] : "00:00:00.000";
}

export default function App() {
  const [ytUrl, setYtUrl] = useState(
    "https://www.youtube.com/watch?v=ZT7CJ-UHXdo"
  );
  const [videoId, setVideoId] = useState("ZT7CJ-UHXdo");
  const [sentences, setSentences] = useState([]);
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState("");

  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const intervalRef = useRef(null);

  function extractVideoId(url) {
    const m = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
    return m ? m[1] : "";
  }

  function timeStrToSec(timeStr) {
    const [h, m, rest] = timeStr.split(":");
    const [s, ms = "0"] = rest.split(".");
    return +h * 3600 + +m * 60 + +s + +ms / 1000; // cần ngoặc ()
  }

  // --------------------
  // API call
  // --------------------
  async function loadTranscript() {
    const vid = extractVideoId(ytUrl);
    if (!vid) {
      setMsg("❌ Invalid YouTube URL");
      return;
    }
    setVideoId(vid);
    setMsg("⏳ Fetching transcript...");

    try {
      const res = await fetch(
        `http://127.0.0.1:5000/download?url=${encodeURIComponent(ytUrl)}`
      );
      const json = await res.json();
      if (!json.success || !json.sentences) {
        setMsg(json.error || "❌ Transcript not found");
      } else {
        setSentences(json.sentences);
        setIdx(0);
        setMsg(`✅ Loaded ${json.sentences.length} sentences`);
      }
    } catch (e) {
      setMsg("⚠️ Backend error: " + e.message);
    }
  }

  // --------------------
  // Play 1 câu
  // --------------------
  async function playSentence(sentence) {
    console.log("sentence", sentence);
    if (!readyRef.current || !playerRef.current || !sentence) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const start = timeStrToSec(tsOnly(sentence.start));
    const end = timeStrToSec(tsOnly(sentence.end));
    const player = playerRef.current;

    await player.seekTo(start, true);
    await player.playVideo();

    intervalRef.current = setInterval(async () => {
      console.log('"ehehehe"', "ehehehe");
      const cur = await player.getCurrentTime();
      console.log("cur", cur);
      console.log("end", end);
      if (cur >= end - 0.1) {
        // pause chính xác hơn
        console.log("player", player);
        await player.pauseVideo();
        await player.seekTo(end, true);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 100);
  }

  // --------------------
  // Next button
  // --------------------
  function next() {
    if (idx < sentences.length) {
      playSentence(sentences[idx]);
      if (idx < sentences.length - 1) {
        setIdx(idx + 1);
      }
    }
  }

  const current = sentences[idx] || null;

  // --------------------
  // UI
  // --------------------
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        padding: 20,
      }}
    >
      {/* Left: Video */}
      <div>
        <h3>🎬 Video</h3>
        <input
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
          placeholder="Paste YouTube URL..."
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button onClick={loadTranscript}>Load</button>
        <p style={{ color: "#555" }}>{msg}</p>
        <YouTube
          videoId={videoId}
          opts={{ width: "100%", playerVars: { controls: 1 } }}
          onReady={(e) => {
            playerRef.current = e.target;
            readyRef.current = true;
          }}
        />
      </div>

      {/* Right: Dictation */}
      <div>
        <h3>📝 Listen & Type</h3>
        {current && (
          <p>
            <b>
              Sentence {idx + 1}/{sentences.length}
            </b>{" "}
            ({current.start} → {current.end})
          </p>
        )}
        <button
          onClick={next}
          disabled={
            !readyRef.current ||
            sentences.length === 0 ||
            idx >= sentences.length
          }
        >
          Next ➡️
        </button>
      </div>
    </div>
  );
}
