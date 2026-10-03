from flask import Flask, render_template
from dotenv import load_dotenv
import os

# Locally: reads YOUTUBE_API_KEY from .env
# On Vercel: reads from Environment Variables set in the dashboard
load_dotenv()

app = Flask(__name__)


@app.route("/")
def index():
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    return render_template("index.html", api_key=api_key)


if __name__ == "__main__":
    app.run(debug=True)

