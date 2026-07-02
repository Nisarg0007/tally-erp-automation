# Trade Book Import workflow

## What changed
- Added a new backend module for trade parsing in [backend/trade_parser.py](../backend/trade_parser.py).
- Added a new Tally XML generator for purchase/sales trade vouchers in [backend/trade_xml_generator.py](../backend/trade_xml_generator.py).
- Added a dedicated trade-row model and schemas in [backend/trade_models.py](../backend/trade_models.py) and [backend/trade_schemas.py](../backend/trade_schemas.py).
- Extended [backend/app.py](../backend/app.py) with trade import, review CRUD, stock-master validation, and export endpoints.
- Added a new trade review page at [frontend/app/trade/page.tsx](../frontend/app/trade/page.tsx).
- Added quick navigation from the dashboard and step bar in [frontend/app/page.tsx](../frontend/app/page.tsx) and [frontend/components/StepProgress.tsx](../frontend/components/StepProgress.tsx).

## Why
The new workflow is isolated from the existing bank-statement parser and export flow so current bank voucher exports remain unchanged while equities trade books can be reviewed and exported as separate purchase/sales vouchers.
