import os
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from backend.packages.gembaos_core.config import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GembaOS Live Gateway", version="1.4")

LIVE_MODEL = models.get("LIVE", "gemini-3.8-live")
client = genai.Client()

SYSTEM_INSTRUCTION = """
You are Gemba Live, a calm master technician for Nova Drive. Speak in the user's language in short sentences. 
Safety first: before any repair step that involves energy, confirm LOTO. 
Use tools to get asset status and SOP steps; never guess part numbers. 
Track step progress. At the end, ask for a 1-sentence finding and call log_finding.
Glossary: CNC-07, E-2145, Q1 main isolator.
"""

# Declare tools matching the specification
tool_get_asset_status = types.FunctionDeclaration(
    name="get_asset_status",
    description="Get real-time status and active alarms for an asset.",
    parameters={"type": "OBJECT", "properties": {"asset_id": {"type": "STRING"}}, "required": ["asset_id"]}
)
tool_log_finding = types.FunctionDeclaration(
    name="log_finding",
    description="Log a tribal knowledge note after a repair.",
    parameters={"type": "OBJECT", "properties": {"asset_id": {"type": "STRING"}, "note": {"type": "STRING"}}, "required": ["asset_id", "note"]}
)
gemba_tools = types.Tool(function_declarations=[tool_get_asset_status, tool_log_finding])

@app.websocket("/v1/live")
async def live_session(websocket: WebSocket):
    await websocket.accept()
    logger.info("New Gemba Live WebSocket connection established.")
    
    config = types.LiveConnectConfig(
        system_instruction=types.Content(parts=[types.Part.from_text(SYSTEM_INSTRUCTION)]),
        tools=[gemba_tools],
        response_modalities=["AUDIO"]
    )
    
    try:
        async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
            # Task to receive audio/video from client and send to Gemini
            async def receive_from_client():
                async for message in websocket.iter_bytes():
                    # MVP: assuming raw PCM 16kHz audio bytes from the PWA
                    await session.send(input={"data": message, "mime_type": "audio/pcm;rate=16000"})
            
            # Task to receive responses/tool calls from Gemini and send to client
            async def receive_from_gemini():
                async for response in session.receive():
                    if response.server_content and response.server_content.model_turn:
                        for part in response.server_content.model_turn.parts:
                            if part.inline_data:
                                await websocket.send_bytes(part.inline_data.data)
                    
                    # Handle Tool Calling (Proxy to internal API Gateway)
                    if response.tool_call:
                        for call in response.tool_call.function_calls:
                            logger.info(f"Gemini requested tool: {call.name} with args: {call.args}")
                            # TODO: Route `call` to api-gateway REST endpoint using user's token
                            # Mocking successful tool response execution
                            tool_response = types.LiveClientContent(
                                tool_response=types.ToolResponse(
                                    function_responses=[
                                        types.FunctionResponse(
                                            name=call.name,
                                            response={"status": "success", "data": "Alarm E-2145: Spindle vibration high. LOTO required."}
                                        )
                                    ]
                                )
                            )
                            await session.send(input=tool_response)
                            
            import asyncio
            await asyncio.gather(receive_from_client(), receive_from_gemini())

    except WebSocketDisconnect:
        logger.info("Client disconnected from Gemba Live.")
    except Exception as e:
        logger.error(f"Live API session error: {e}")