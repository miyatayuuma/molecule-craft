"""P3.5 mobile touch acceptance using the production encyclopedia and real animation frames."""
import json
import math
import os
from pathlib import Path
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


CASES = {
    "n-butane": (-140, -15, 25),
    "benzene": (1, 26, 100),
    "cyclohexane": (2, 26, 100),
    "oxygen": (-224, -200, -180),
    "chlorine": (-108, -58, -24),
    "nitrogen": (-216, -206, -180),
    "hydrogen": (-262, -257, -247),
    "ammonia": (-83, -56, -22),
    "glycerol": (14, 24, 90),
}
OUT = Path(os.environ.get("PHASE_SCREENSHOTS", "shots/p35"))
OUT.mkdir(parents=True, exist_ok=True)


def run(page, touch, case):
    cold, liquid, hot = CASES[case]
    slider = page.locator("#water-temp")
    stage = page.locator(".water-stage")
    badge = page.locator(".water-identity small")
    grip = page.locator(".water-grip")
    gauge = page.locator(".water-pressure")
    temperature = page.locator(".water-degrees")

    def state(phase, temp=None):
        page.wait_for_function(
            """([phase,temp])=>document.querySelector('.water-identity small')?.dataset.phase===phase
            && (temp===null || Number(document.querySelector('.water-degrees').value)===temp)""",
            arg=[phase,temp], timeout=20000,
        )
        assert .5 <= float(gauge.inner_text()) <= 3
        shares = page.locator(".water-phase-strip i").evaluate_all(
            "(bands)=>bands.map(e=>Number(e.style.getPropertyValue('--share')))"
        )
        assert min(shares) >= 0 and math.isclose(sum(shares), 1, abs_tol=1e-8)
        rect = grip.bounding_box()
        assert 0 <= rect["x"] and rect["x"] + rect["width"] <= page.viewport_size["width"]
        assert rect["y"] + rect["height"] < slider.bounding_box()["y"]

    def move_slider(value):
        rect = slider.bounding_box()
        lo, hi, step = [float(slider.get_attribute(key)) for key in ("min","max","step")]
        x = rect["x"] + 8 + (rect["width"] - 16) * (value-lo) / (hi-lo)
        y = rect["y"] + rect["height"]/2
        touch("Start", x,y)
        touch("End")
        diff = round((value - float(slider.input_value())) / step)
        for _ in range(abs(diff)):
            slider.press("ArrowRight" if diff > 0 else "ArrowLeft")
        assert float(slider.input_value()) == value

    def piston(dy):
        rect = grip.bounding_box()
        x, y = rect["x"] + rect["width"]/2, rect["y"] + rect["height"]/2
        touch("Start", x, y)
        touch("Move", x, y+dy)
        touch("End")

    def screenshot(phase):
        page.locator("dialog.water-piston").screenshot(path=str(OUT/f"{case}-{phase}.png"), animations="disabled")

    def frames(phase):
        times = sorted(page.evaluate("""async()=>{
          const times=[];let previous=await new Promise(requestAnimationFrame);
          while(times.length<75){const now=await new Promise(requestAnimationFrame); times.push(now-previous);previous=now;}
          return times;
        }"""))
        print(f"{case} {phase}: {1000/(sum(times)/len(times)):.1f} fps, median {times[37]:.1f} ms, p95 {times[71]:.1f} ms",flush=True)

    page.locator("#open-water-piston").click()
    stage.locator("canvas").wait_for(state="attached")
    if case=="n-butane":
        state("gas",25)
        piston(181)
        state("mixed",25)
        assert 2.39<=float(gauge.inner_text())<=2.41
        screenshot("coexistence")
        piston(132)
        state("liquid",25)
        piston(-252)
        state("gas",25)
    move_slider(cold)
    state("ice",cold)
    page.wait_for_timeout(650)
    screenshot("solid")

    move_slider(liquid)
    state("liquid",liquid)
    screenshot("liquid")
    if os.environ.get("PHASE_MEASURE"):
        frames("liquid")
    move_slider(hot)
    phase="liquid" if case=="glycerol" else "gas"
    state(phase,hot)
    screenshot("hot" if case=="glycerol" else "gas")
    if case=="glycerol" and os.environ.get("PHASE_MEASURE"):
        frames("warm liquid")
    page.locator(".water-reset").click()
    state(phase,24 if case=="glycerol" else None)
    page.wait_for_function("document.querySelector('.water-pressure').value==='1.00'")
    page.locator(".water-close").click()
    page.locator("#open-water-piston").click()
    state(phase)
    assert float(gauge.inner_text())==1
    assert badge.is_visible()
    page.locator(".water-close").click()


def main():
    server = ThreadingHTTPServer(("127.0.0.1",0),QuietHandler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    selected=os.environ.get("PHASE_CASES")
    cases=selected.split(",") if selected else list(CASES)
    width=int(os.environ.get("PHASE_SCREEN_WIDTH","390"))
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"),
            args=["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader","--ignore-gpu-blocklist"])
        context=browser.new_context(viewport={"width":width,"height":844 if width==390 else 740},
            has_touch=True,is_mobile=True,device_scale_factor=1)
        context.add_init_script("let seed=124; Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);")
        save={"schemaVersion":3,"discoveredMolecules":[{"id":id,"at":1,"order":i+1} for i,id in enumerate(CASES)],
              "discoveredGroups":[],"unlockedStructures":[],"legacyElements":[],"milestones":[]}
        context.add_init_script("localStorage.setItem('molecule-craft.collection.v1',"+json.dumps(json.dumps(save))+")")
        page=context.new_page()
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(f"http://127.0.0.1:{server.server_port}/?reactionLabTest=1")
        page.wait_for_function("!document.querySelector('#open-reaction-lab').disabled")
        cdp=context.new_cdp_session(page)

        def touch(kind,x=0,y=0):
            cdp.send("Input.dispatchTouchEvent",{"type":"touch"+kind,
                "touchPoints":[] if kind=="End" else [{"x":x,"y":y,"id":1}]})

        for case in cases:
            page.evaluate("id=>dispatchEvent(new CustomEvent('molecule-craft:open-molecule',{detail:{id}}))",case)
            try:
                run(page,touch,case)
            except Exception:
                page.screenshot(path=str(OUT/f"{case}-failure.png"))
                raise
            assert not errors,errors
            print(width, case, "passed",flush=True)


if __name__=="__main__":
    main()
