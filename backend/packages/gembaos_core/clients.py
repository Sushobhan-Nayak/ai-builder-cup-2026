import os
from google.cloud import bigquery, firestore, pubsub_v1

PROJECT_ID = os.getenv("PROJECT_ID", "gembaos-prod")

# Lazy initialization to prevent overhead during container build phases
_bq_client = None
_fs_client = None
_pubsub_publisher = None

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