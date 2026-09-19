import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),captureDir=join(root,'test-results','craft-stereo-observation');
const html=await readFile(join(root,'index.html'),'utf8'),craftHtml=html.replace(/\s*<script type="module" src="\.\/src\/pwa\.js[^"]*"><\/script>/g,'');
const seedHtml='<!doctype html><meta charset="utf-8"><title>CRAFT stereo seed</title>';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const debugSource=