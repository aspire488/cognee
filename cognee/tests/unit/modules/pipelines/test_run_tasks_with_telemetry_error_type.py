import asyncio
from types import SimpleNamespace

import cognee.modules.pipelines.operations.run_tasks_with_telemetry as telemetry


def test_pipeline_error_telemetry_records_exception_type(monkeypatch):
    sent = []

    async def failing_tasks(*args, **kwargs):
        raise RuntimeError("example failure")

    monkeypatch.setattr(telemetry, "get_current_settings", lambda: {})
    monkeypatch.setattr(telemetry, "run_tasks_base", failing_tasks)
    monkeypatch.setattr(
        telemetry,
        "send_telemetry",
        lambda event, user, additional_properties: sent.append(
            (event, additional_properties)
        ),
    )

    async def run():
        try:
            async for _ in telemetry.run_tasks_with_telemetry(
                [], None, SimpleNamespace(tenant_id=None), "test_pipeline"
            ):
                pass
        except RuntimeError:
            return

        raise AssertionError("expected pipeline failure")

    asyncio.run(run())

    errored = [item for item in sent if item[0] == "Pipeline Run Errored"]
    assert len(errored) == 1
    assert errored[0][1]["error_type"] == "RuntimeError"
    assert "error_message" not in errored[0][1]
