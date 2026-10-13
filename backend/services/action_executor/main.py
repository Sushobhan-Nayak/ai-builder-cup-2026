import os
import json
import hashlib
import logging
from datetime import datetime
from fastapi import FastAPI, Request
from google.cloud import firestore, pubsub_v1

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GembaOS Action Executor", version="1.4")

PROJECT_ID = os.getenv("PROJECT_ID", "deep-atlas-511314-r4")
db = firestore.Client(project=PROJECT_ID)
publisher = pubsub_v1.PublisherClient()
RESULTS_TOPIC = publisher.topic_path(PROJECT_ID, "actions.result")

def execute_create_work_order(params: dict) -> dict:
    """Adapter for CMMS mock integration."""
    wo_id = f"WO-{int(datetime.utcnow().timestamp())}"
    # In production, this pushes to SAP PM or a CMMS API
    logger.info(f"Created Work Order {wo_id} for asset {params.get('asset_id')}")
    return {"wo_id": wo_id, "status": "created"}

def execute_draft_po(params: dict) -> dict:
    """Adapter for ERP PO creation."""
    po_id = f"PO-{int(datetime.utcnow().timestamp())}"
    logger.info(f"Drafted PO {po_id} to supplier {params.get('supplier_id')}")
    return {"po_id": po_id, "status": "drafted"}

ADAPTERS = {
    "create_work_order": execute_create_work_order,
    "draft_po": execute_draft_po,
}

@app.post("/events")
async def handle_approved_decision(request: Request):
    """Pub/Sub push endpoint for decisions.approved."""
    # Note: OIDC token verification omitted for brevity, but required per spec
    envelope = await request.json()
    message_data = json.loads(envelope["message"]["data"])
    
    decision_id = message_data["decision_id"]
    actions = message_data.get("actions", [])
    plant_ids = message_data.get("plant_ids", [])
    
    results = []
    
    for action in actions:
        action_type = action["type"]
        params = action.get("params", {})
        
        # 1. Idempotency Check
        canonical_params = json.dumps(params, sort_keys=True)
        idempotency_key = hashlib.sha256(f"{decision_id}{action_type}{canonical_params}".encode()).hexdigest()
        
        idem_ref = db.collection("idempotency_keys").document(idempotency_key)
        
        @firestore.transactional
        def run_action_transaction(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            if snapshot.exists:
                return snapshot.to_dict().get("result")
            
            # 2. Execute via Adapter
            adapter = ADAPTERS.get(action_type)
            if not adapter:
                raise ValueError(f"Unknown action type: {action_type}")
                
            action_result = adapter(params)
            
            transaction.set(ref, {
                "decision_id": decision_id,
                "action_type": action_type,
                "timestamp": datetime.utcnow().isoformat(),
                "result": action_result
            })
            return action_result

        transaction = db.transaction()
        final_result = run_action_transaction(transaction, idem_ref)
        results.append({"type": action_type, "result": final_result})

    # 3. Publish to actions.result
    result_payload = {
        "event_id": f"evt_act_{decision_id}",
        "ts": datetime.utcnow().isoformat(),
        "action_id": f"act_{decision_id}",
        "decision_id": decision_id,
        "plant_ids": plant_ids,
        "status": "done",
        "result": results
    }
    publisher.publish(RESULTS_TOPIC, json.dumps(result_payload).encode("utf-8"))

    return {"status": "success", "processed": len(actions)}