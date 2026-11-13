import subprocess, sys, re, json, os
from concurrent.futures import ThreadPoolExecutor
# uso: bal.py N "tune-json" cfg...   cfg = s3_10 (smart dark np3 10min) | h4_20 (humano np4 20 min) | a3_20 (allgood)
N=int(sys.argv[1]); tune=sys.argv[2]; cfgs=sys.argv[3:]
env=dict(os.environ); env["UMBRAL_TUNE"]=tune
def run(c):
    k=c[0]; np_,m=c[1:].split("_"); e=dict(env); e["NP"]=np_
    if k=="s": out=subprocess.run(["node","smart.js",str(N),m,"1dark"],env=e,capture_output=True,text=True).stdout; j=json.loads(out[out.index("{"):]); return c,"asesino gana %.1f%% | emergente %.0f%%"%(100*j["asesino"]/N,100*j["assassinMade"]/N)
    mode="human" if k=="h" else "allgood"
    out=subprocess.run(["node","smart_human.js",str(N),m,mode],env=e,capture_output=True,text=True).stdout
    em=re.search(r'emergente ([\d.]+)%',out).group(1); a=re.search(r'\(de todas\) ([\d.]+)%',out).group(1); cc=re.search(r'con asesino\) ([\d.]+)%',out).group(1); su=re.search(r'supers ([\d.]+)%',out).group(1)
    return c,"emergente %s%% | asesino gana (todas) %s%% (con ases %s%%) | supers %s%%"%(em,a,cc,su)
with ThreadPoolExecutor(2) as ex:
    for c,r in ex.map(run,cfgs): print(c.ljust(6),r,flush=True)
