#!/usr/bin/env node
// LAB131: non-invasive UI contract, run inside the existing Codespaces build.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/components/AppScreens.jsx','utf8');
const css=readFileSync('src/appShellV16.css','utf8');
const labels=['Capitoli','Pagine del libro','Pagine elaborate','Concetti individuati','Riduzione effettiva del libro','Copertura media (testo base)'];
const metricsStart=src.indexOf('<h2>Controllo del libro</h2>');
const metricsEnd=src.indexOf('</article>}',metricsStart);
const metricSection=src.slice(metricsStart,metricsEnd);
assert.ok(metricsStart>0&&metricsEnd>metricsStart,'six-metric card present');
let prev=-1;
for(const label of labels){
 const at=metricSection.indexOf('<span>'+label+'</span>');
 assert.ok(at>prev,'ordered metric '+label);
 prev=at;
}
assert.equal((metricSection.match(/<div><span>/g)||[]).length,6);
assert.ok(src.indexOf('sb-book-quick-actions')<metricsStart);
assert.ok(src.indexOf('sb-study-description-bottom')>metricsEnd);
assert.ok(src.includes('editionState?.totalChunkVariants'),'page count from book metadata');
assert.ok(src.includes('editionState?.verifiedChunkVariants'),'processed pages from actual progress');
assert.ok(!src.includes('Libro con {reservedPagesV127.length} pagine da rivedere'));
assert.ok(!src.includes('Controllo per pagina ·'));
assert.ok(!src.includes('Pagine pronte sul telefono:'));
assert.equal((src.match(/Unica spiegazione completa in parole semplici/g)||[]).length,1);
assert.ok(src.includes('Scegli la riduzione del libro'),'non-explained levels preserved');
for(const key of ['sb-home-source-actions','sb-home-library-actions']){
 assert.match(css,new RegExp('\\.'+key+' button:first-child \\{\\s*background:#fff;'));
}
assert.ok(css.includes('button:active:not(:disabled)'));
console.log('LAB131 UI CONTRACT PASS: Studio, 6 metriche, Home bianca, diagnostica interna preservata.');
