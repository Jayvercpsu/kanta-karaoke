from flask import Flask, render_template
from dotenv import load_dotenv
import os

# Load .env locally; on Vercel, env vars come from the dashboard
load_dotenv()

app = Flask(__name__)


@app.route("/")
def index():
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    return render_template("index.html", api_key=api_key)


# Vercel needs the `app` object exposed at module level (no __main__ guard needed,
# but keeping it lets you still run locally with `python app.py`)
if __name__ == "__main__":
    app.run(debug=True)

