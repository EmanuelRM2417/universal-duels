import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Regresión aislada de los cuatro tipos de condición con ID opcional.
const html=readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
const engine=readFileSync(new URL('./battle-engine.js',import.meta.url),'utf8');
const list=html.match(/const conditionOptions = (\[[^;]+\]);/);
assert.ok(list,'Debe existir la lista normal de condiciones');
const opts=runInNewContext(list[1]);
const cases=[['weather_is','Clima activo','weathers'],['field_is','Campo activo','fields'],['scenario_is','Escenario activo','scenarios'],['has_status','Tiene alteración de estado','statuses']];
for(const [id,name] of cases){
 assert.equal(opts.filter(pair=>pair[0]===id).length,1,`La condición ${id} debe existir exactamente una vez`);
 assert.equal(opts.find(pair=>pair[0]===id)?.[1],name,`Etiqueta visible de ${id}`);
}
const start=html.indexOf('    function optionSelect(options, value) {');
const end=html.indexOf('    const cachedCatalog = {};',start);
assert.ok(start>=0 && end>start,'Selector normal sin variantes especiales');
const code=html.slice(start,end);
assert.doesNotMatch(code,/function conditionSelect\(/,'No conservar un selector paralelo que sustituya la regresión');
const context={document:{createElement:()=>({options:[],add(option){this.options.push(option)},value:''})},Option:class {constructor(text,value){this.text=text;this.value=value}}};
const select=runInNewContext(code+'\noptionSelect',context);
for(const [id,name] of cases){
 const field=select(opts,id);
 assert.equal(field.value,id);
 assert.equal(field.options.find(x=>x.value===id)?.text,name);
 assert.ok(!field.options.some(x=>x.text==='Otro: '+id),`${id} jamás debe mostrarse como «Otro»`);
}
assert.match(html,/optionSelect\(conditionOptions,rule\.condition\?\.type\|\|'always'\)/,'Usa la misma lista en condición principal');
assert.match(html,/optionSelect\(conditionOptions,c\.type\?\?''\)/,'Usa la misma lista en condiciones adicionales');
assert.match(html,/weather_is:'weathers',field_is:'fields',scenario_is:'scenarios',has_status:'statuses'/,'Referencia por ID disponible para las cuatro condiciones');
assert.match(html,/Cualquier elemento \(dejar vacío\)/,'El usuario puede limpiar el ID de la condición principal');
assert.match(html,/textContent='Cualquiera'/,'El usuario puede limpiar el ID de una condición adicional');
assert.match(html,/\[data-condition-ref\]/,'Se guarda el ID seleccionado o vacío en la condición principal');
assert.match(html,/\[data-reference-value\]/,'Se guarda el ID seleccionado o vacío en las adicionales');

// Evaluación REAL del motor, sin alterar su código: vacío = cualquier activo.
const mstart=engine.indexOf('function meets(cond,user,target,state){');
const mend=engine.indexOf('\nfunction conditionsPass(',mstart);
assert.ok(mstart>=0&&mend>mstart);
const meets=runInNewContext(engine.slice(mstart,mend)+'\nmeets',{effective:()=>0});
const actor={side:'left',status:{id:'quemadura',turns:3},hp:100,maxHp:100};
const state={weather:'lluvia',field:'pradera',scenario:'biblioteca-de-alejandria'};
for(const [type,,key] of cases){
 const actual=type==='weather_is'?state.weather:type==='field_is'?state.field:type==='scenario_is'?state.scenario:actor.status.id;
 const active={type,value:''};
 assert.equal(meets(active,actor,null,state),true,`${type}: ID vacío reconoce cualquiera activo`);
 assert.equal(meets({...active,value:actual},actor,null,state),true,`${type}: ID coincidente`);
 assert.equal(meets({...active,value:'un-id-distinto'},actor,null,state),false,`${type}: ID no coincidente`);
 const vacant={...state,...(type==='weather_is'?{weather:''}:type==='field_is'?{field:''}:type==='scenario_is'?{scenario:''}:{})};
 const noStatus=type==='has_status'?{...actor,status:null}:actor;
 assert.equal(meets(active,noStatus,null,vacant),false,`${type}: sin elemento activo NO se cumple`);
}
console.log('OK: cuatro condiciones, etiqueta Escenario activo, selector original, IDs vacíos y coincidencias en motor.');
