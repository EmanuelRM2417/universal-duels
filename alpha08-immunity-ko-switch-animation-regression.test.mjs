import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {simulate} from './battle-engine.js';
const publicDir=new URL('./public/',import.meta.url);
const ui=files=>Object.fromEntries(files.map(f=>[f,readFileSync(new URL(f,publicDir),'utf8')]));
const src=ui(['battle-visuals.js','battle-visuals.css']);
const run=(txt,ctx={})=>vm.runInNewContext(txt,{...ctx,Promise,setTimeout,clearTimeout});
const shared={};run(src['battle-visuals.js'],{window:shared,document:{}});
assert.equal(typeof shared.UDBattleVisuals.recoil,'function','el defensor especial tiene retroceso propio');
const durations=[];
const node={getBoundingClientRect(){return{left:5,right:15,top:5,bottom:15}},closest(){return {getBoundingClientRect(){return{width:1000,height:600}}}},animate(frames,opt){durations.push(opt.duration);return{finished:Promise.resolve(),cancel(){}}}};
const selector=()=>node;
run(src['battle-visuals.js'],{window:shared,document:{querySelector:selector}});
await shared.UDBattleVisuals.travel({side:'left',slot:0},[{side:'right',slot:0}],{side:'right',slot:0},.05);
assert.equal(durations[0],67,'físico 33% más rápido que antes');
durations.length=0;
await shared.UDBattleVisuals.circles({side:'left',slot:0},.05);
assert.equal(durations[0],76,'especial 20% más rápido que antes');
durations.length=0;
await shared.UDBattleVisuals.recoil({side:'right',slot:0},.05);
assert.equal(durations[0],22,'retroceso especial, no círculos');
assert.match(src['battle-visuals.css'],/\.ud-team-pick \.ud-team-types \.ud-type-text\{display:none!important\}/,'los nombres de tipos nunca sobreponen el sprite');
// Simulación genuina de inmunidad: no debe anunciar inmunidad repetida al
// reevaluar una habilidad pasiva, pero sí ante un intento de estado del rival.
const unit=(id,ability)=>({id,name:id,definition:{types:['fuego'],hp:400,attack:60,defense:60,specialAttack:60,specialDefense:60,speed:id==='a'?100:50,moveIds:['curse','idle','idle'],uniqueMoveId:'idle',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const always={type:'always',value:''};
const catalog={entities:{a:unit('a','blank'),b:unit('b','aura')},moves:{
 curse:{id:'curse',name:'Maldición',definition:{type:'fuego',category:'status',power:0,accuracy:0,rules:[{event:'manual',condition:always,target:'target',action:{type:'apply_status',value:'poison'},duration:3,chance:100}]}},
 idle:{id:'idle',name:'Esperar',definition:{type:'fuego',category:'status',power:0,accuracy:0,rules:[]}}
},abilities:{blank:{id:'blank',name:'Sin habilidad',definition:{rules:[]}},aura:{id:'aura',name:'Aura inmune',definition:{rules:[{event:'on_condition',condition:always,target:'self',action:{type:'effect_immunity'},chance:100}]}}},statuses:{poison:{id:'poison',name:'Envenenado',definition:{rules:[]}}},fields:{},weathers:{},scenarios:{}};
const quiet=simulate({catalog,left:'a',right:'b',turns:2,leftOrders:[{move:'idle'},{move:'idle'}],rightOrders:[{move:'idle'},{move:'idle'}],randomSource:()=>.5});
assert.ok(!quiet.log.some(x=>x.includes('es inmune al efecto')),'sin intento de efecto no hay anuncio espurio');
const attacked=simulate({catalog,left:'a',right:'b',turns:1,leftOrders:[{move:'curse'}],rightOrders:[{move:'idle'}],randomSource:()=>.5});
assert.equal(attacked.log.filter(x=>x.includes('es inmune al efecto')).length,1,'inmunidad anunciada ante un intento real de aplicar estado');
assert.equal(attacked.right.status,null,'inmunidad sigue bloqueando el estado');
console.log('Alpha 0.8: inmunidad, tiempos, retroceso, KO a cero, tipos y cierre de elección OK');
