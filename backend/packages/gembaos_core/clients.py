import os
from dotenv import load_dotenv
from google.cloud import bigquery, firestore, pubsub_v1

load_dotenv()

PROJECT_ID = os.getenv("PROJECT_ID", "deep-atlas-511314-r4")

# Lazy initialization to prevent overhead during container build phases
_bq_client = None
_fs_client = None
_pubsub_publisher = None
_genai_client = None

def get_bq_client() -> bigquery.Client:
    global _bq_client
    if not _bq_client:
        _bq_client = bigquery.Client(project=PROJECT_ID)
    return _bq_client

def get_firestore_client() -> firestore.Client:
    global _fs_client
    if not _fs_client:
        _fs_client = firestore.Client(project=PROJECT_ID)
    return _fs_client

def get_pubsub_publisher() -> pubsub_v1.PublisherClient:
    global _pubsub_publisher
    if not _pubsub_publisher:
        _pubsub_publisher = pubsub_v1.PublisherClient()
    return _pubsub_publisher

def get_genai_client():
    global _genai_client
    if not _genai_client:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            _genai_client = genai.Client(api_key=api_key)
        else:
            _genai_client = genai.Client()
    return _genai_client