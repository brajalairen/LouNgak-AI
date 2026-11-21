"""Field-operations store and demo readiness from the command line.

  python -m satquery.ops seed-demo     restore the DEMO reports and alert (idempotent; real records are kept)
  python -m satquery.ops reset         delete every report, task, acknowledgement and DEMO alert
  python -m satquery.ops preflight     check this machine is ready to demo; exits non-zero on any FAIL
"""

import argparse
import sys

from satquery.ops import seed
from satquery.settings import load_settings
from satquery.store import Store


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m satquery.ops", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("seed-demo", "reset", "preflight"))
    args = parser.parse_args()
    settings = load_settings()
    if args.command == "preflight":
        from satquery.ops import preflight

        text, code = preflight.report(preflight.run(settings))
        print(text)
        sys.exit(code)
    store = Store(settings.db_path)
    if args.command == "reset":
        seed.reset(store)
        print(f"Cleared the field-operations records in {store.path}.")
    else:
        created = seed.seed(store)
        print(f"Restored {len(created)} DEMO record(s) in {store.path}: {', '.join(created)}")


if __name__ == "__main__":
    main()
