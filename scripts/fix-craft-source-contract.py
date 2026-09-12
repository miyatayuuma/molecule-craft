from pathlib import Path

path=Path('src/app.js')
text=path.read_text()
old="function onPointerCancel(e){abortPointerInteraction(e);}"
new="function onPointerCancel(e){if(!activePointers.has(e.pointerId))return;abortPointerInteraction(e);}"
if old not in text: raise SystemExit('pointer cancel wrapper not found')
path.write_text(text.replace(old,new,1))
Path('scripts/fix-craft-source-contract.py').unlink(missing_ok=True)
