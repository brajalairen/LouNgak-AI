"""Field-operations store from the command line.

  python -m satquery.ops seed-demo     add the DEMO reports and alert (keeps existing records)
  python -m satquery.ops reset         delete every report, task, acknowledgement and DEMO alert
"""

import argparse

from satquery.ops import seed
from satquery.settings import load_settings
from satquery.store import Store


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m satquery.ops", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("seed-demo", "reset"))
    args = parser.parse_args()
    store = Store(load_settings().db_path)
    if args.command == "reset":
        seed.reset(store)
        print(f"Cleared the field-operations records in {store.path}.")
    else:
        created = seed.seed(store)
        print(f"Added {len(created)} DEMO record(s) to {store.path}: {', '.join(created)}")


if __name__ == "__main__":
    main()
