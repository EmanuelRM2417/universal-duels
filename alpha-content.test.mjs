import assert from 'node:assert/strict';
import { loadPublishedContent } from './worker.js';
const snapshot={ok:true,version:'0.2.0-alpha',revision:'patch-test',publishedAt:'2026-10-04T00:00:00.000Z',types:['fuego'],chart:{fuego:{fuego:'neutral'}},catalog:{entities:{e1:{id:'e1',name:'Entidad',definition:{}}},moves:{m1:{id:'m1',name:'Golpe',definition:{}}},abilities:{},effects:{},statuses:{},weathers:{},fields:{},scenarios:{}}};
const kv={async get(key,type){if(key!=='public-v1:current')return null;return type==='json'?structuredClone(snapshot):JSON.stringify(snapshot);}};
const s=await loadPublishedContent({PUBLIC_CONTENT:kv});
assert.equal(s.revision,'patch-test');assert.equal(s.catalog.entities.e1.name,'Entidad');assert.equal(s.chart.fuego.fuego,'neutral');
await assert.rejects(()=>loadPublishedContent({PUBLIC_CONTENT:{get:async()=>null}}),/No hay un parche público/);
console.log('manual public patch content test ok');
