# -*- coding: utf-8 -*-
"""PRIS 원자로 상세 페이지 전수 수집 v2
v1의 curl --parallel이 Windows에서 간헐적으로 멈추는 문제를 회피:
- curl 프로세스 하나가 URL 30개를 직렬 처리(연결 재사용) × 스레드 4개 병렬
"""
import subprocess, sys, pathlib, concurrent.futures as cf

CACHE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("pris_cache")
MAX_ID = int(sys.argv[2]) if len(sys.argv) > 2 else 1250
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
BASE = "https://pris.iaea.org/PRIS/CountryStatistics/ReactorDetails.aspx?current={}"
CACHE.mkdir(parents=True, exist_ok=True)

todo = []
for i in range(1, MAX_ID + 1):
    out = CACHE / f"r{i}.html"
    if not (out.exists() and out.stat().st_size > 5000):
        todo.append(i)
print(f"todo: {len(todo)}", flush=True)

def run_batch(ids):
    args = ["curl", "-s", "-A", UA, "--max-time", "30", "--connect-timeout", "10"]
    for i in ids:
        args += [BASE.format(i), "-o", str(CACHE / f"r{i}.html")]
    subprocess.run(args, check=False, timeout=len(ids) * 35)
    return len(ids)

BATCH = 30
batches = [todo[k:k + BATCH] for k in range(0, len(todo), BATCH)]
done = 0
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    for n in ex.map(run_batch, batches):
        done += n
        print(f"progress {done}/{len(todo)}", flush=True)

ok = sum(1 for i in range(1, MAX_ID + 1)
         if (CACHE / f"r{i}.html").exists() and (CACHE / f"r{i}.html").stat().st_size > 5000)
print(f"DONE cached={ok}/{MAX_ID}")
