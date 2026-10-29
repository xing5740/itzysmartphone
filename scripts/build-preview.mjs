import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=new URL('../',import.meta.url);
let html=await readFile(new URL('index.html',directory),'utf8');
const css=await readFile(new URL('css/style.css',directory),'utf8');
const config=await readFile(new URL('js/config.js',directory),'utf8');
let bundled='';
for(const filename of ['core.js','storage.js','icons.js','weather.js','app.js']) {
  const source=await readFile(new URL(`js/${filename}`,directory),'utf8');
  bundled+=source.replace(/^import .+;\n/gm,'').replace(/^export /gm,'')+'\n';
}
html=html.replace('<link rel="stylesheet" href="css/style.css">',`<style>${css}</style>`)
  .replace('<script src="js/config.js"></script>',`<script>${config}</script>`)
  .replace('<script type="module" src="js/app.js"></script>',`<script type="module">${bundled}</script>`);
await writeFile(new URL('preview.html',directory),html);
console.log(`Preview: ${fileURLToPath(new URL('preview.html',directory))}`);
