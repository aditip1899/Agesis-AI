import asyncio
import os
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
from emergentintegrations.llm.openai import OpenAITextToSpeech

SCENES = {
    "01_login": "AegisAI is a governance platform for generative AI. It tracks how your teams use ChatGPT, Codex and command line tools, turning invisible AI usage into clear insight on spend, code and efficiency. Let's take a look.",
    "02_personal": "Every employee gets a personal dashboard. At a glance you see total spend, tokens consumed, the percentage of your committed code that was AI authored, and an efficiency score. Below are your spend trend and how it splits across work categories.",
    "03_cost": "The Cost and Runbook page tracks cost per outcome and a token budget, with a reminder before you run out, so spend never surprises you.",
    "04_policies": "It also scores the risk of every AI tool. Compliance defines connector policies, like single sign on, data retention and license scanning, and the risk score recomputes live from those controls plus recent alerts.",
    "05_governance": "Compliance and executives get the organization view: total spend against budget, active engineers, the share of AI generated code, and a breakdown by department.",
    "06_audit": "The Audit Center flags anomalies, possible personal data in prompts, license conflicts and shadow AI usage, each with a plain language explanation.",
    "07_alerts": "Budget alerts fire automatically every day, in the app and to Slack, the moment usage crosses your threshold.",
    "08_assistant": "And Ask Aegis, a built in copilot powered by Claude and ChatGPT, answers questions about your usage in plain language, streaming its response in real time. AegisAI. Govern generative AI spend, code and efficiency, without slowing engineers down.",
}


async def main():
    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
    for key, text in SCENES.items():
        audio = await tts.generate_speech(text=text, model="tts-1-hd", voice="onyx")
        out = f"/app/demo_frames/{key}.mp3"
        with open(out, "wb") as f:
            f.write(audio)
        print("wrote", out, len(audio), "bytes")


asyncio.run(main())
