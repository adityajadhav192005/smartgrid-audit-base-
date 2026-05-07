from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from urllib.request import urlopen, Request


DEFAULT_TARGET_DIR = Path("smartgrid_mas") / "data" / "network_intrusion"
DATASETS = {
    "unsw": [
        (
            "unsw_nb15_train.csv",
            "https://huggingface.co/datasets/Mireu-Lab/UNSW-NB15/resolve/main/train.csv?download=true",
        ),
        (
            "unsw_nb15_test.csv",
            "https://huggingface.co/datasets/Mireu-Lab/UNSW-NB15/resolve/main/test.csv?download=true",
        ),
    ],
}


def download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": "smartgrid-mas-branch2-downloader/1.0"})
    with urlopen(request, timeout=120) as response, destination.open("wb") as fh:
        shutil.copyfileobj(response, fh)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download branch-2 intrusion dataset files")
    parser.add_argument("--dataset", default="unsw", choices=sorted(DATASETS.keys()))
    parser.add_argument("--target-dir", default=str(DEFAULT_TARGET_DIR))
    args = parser.parse_args()

    target_dir = Path(args.target_dir)
    for filename, url in DATASETS[args.dataset]:
        destination = target_dir / filename
        print(f"Downloading {filename} ...")
        download_file(url, destination)
        print(f"Saved {destination}")

    print("=" * 72)
    print("BRANCH-2 DATASET DOWNLOAD COMPLETE")
    print("=" * 72)
    print(f"SMARTGRID_NET_DATA_PATH={target_dir / 'unsw_nb15_train.csv'};{target_dir / 'unsw_nb15_test.csv'}")
    print("SMARTGRID_NET_LABEL_COLUMN=label")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
