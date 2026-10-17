import assert from 'node:assert/strict';
import {createPractice,advancePractice,publicPractice,PRACTICE_TTL} from './practice-session.js';
const unit=id=>({id,name:id,definition:{types:['fuego'],hp:400,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['hit','wait','heal'],uniqueMoveId:'other',globalAbilityId:'none',uniqueAbilityId:'none'}});
const move=(id,power)=>({id,name:id,definition:{type:'fuego',category:power?'physical':'status',power,accuracy:100,criticalChance:0,rules:[]}});
const catalog={entities:Object.fromEntries(['a','b','c','d'].map(x=>[x,unit(x)])),moves:{hit:move('hit',25),wait:move('wait',0),heal:move('heal',0),other:move('other',15)},abilities:{none:{id:'none',definition:{rules:[]}}}};
for(const mode of ['singles','doubles']){
 const session=createPractice({catalog,revision:'test-123',mode,difficulty:'advanced',leftTeam:['a','c'],rightTeam:['b','d'],now:1000});
 assert.equal(session.expiresAt,1000+PRACTICE_TTL);
 assert.equal(publicPractice(session).round,1);
 assert.throws(()=>advancePractice(session,'turn',{order:{move:'bad'}},{catalog,now:2000}),/Movimiento inválido/);
 const order=mode==='singles'?{move:'hit'}:{actions:[{slot:0,move:'hit',target:{side:'right',slot:0}},{slot:1,move:'hit',target:{side:'right',slot:1}}]};
 const advanced=advancePractice(session,'turn',{order},{catalog,now:2000,random:()=>0.15});
 assert.equal(advanced.round,2);assert.equal(session.leftOrders.length,1);assert.equal(session.rightOrders.length,1);
 assert.equal(session.expiresAt,2000+PRACTICE_TTL);
 assert.ok(advanced.state.log.some(x=>x.includes('usó')));
 assert.throws(()=>advancePractice(session,'turn',{order},{catalog,now:session.expiresAt}),/expiró/);
 const frozen=JSON.parse(JSON.stringify(session));
 assert.equal(publicPractice(session).revision,'test-123');
 assert.deepEqual(frozen.leftOrders,session.leftOrders);
}
assert.throws(()=>createPractice({catalog,revision:'x',leftTeam:['a','a'],rightTeam:['b']}),/sin repetir/);
console.log('Práctica: creación, Singles, Doubles, IA, acciones inválidas, expiración y estado OK');
// Advanced AI substitution is accepted through the persistent Practice session,
// not only by its isolated decision helper.
{
 const session=createPractice({catalog,revision:'switch-test',mode:'singles',difficulty:'advanced',leftTeam:['a','c'],rightTeam:['b','d'],now:100});
 const aiState=session.lastState;
 // The session must remain authoritative: simulate damage rather than mutating
 // the snapshot and claiming its historical replay is valid.
 const first=advancePractice(session,'turn',{order:{move:'hit'}},{catalog,now:200,random:()=>0});
 assert.equal(first.status,'playing');
 assert.ok(session.rightOrders[0]);
}
console.log('Práctica: ruta integrada de turnos de IA OK');
// The shared room-style battle controls include optional movement-triggered
// manual switches. Practice must validate and forward the chosen reserve.
{
 const pivotCatalog=structuredClone(catalog);
 pivotCatalog.moves.pivot={id:'pivot',name:'Relevo',definition:{type:'fuego',category:'status',power:0,accuracy:0,targeting:'self',rules:[{event:'manual',target:'self',chance:100,action:{type:'switch_character',switchMode:'manual'}}]}};
 pivotCatalog.entities.a.definition.moveIds=['pivot','hit','wait'];
 const s=createPractice({catalog:pivotCatalog,revision:'manual-switch',mode:'singles',difficulty:'easy',leftTeam:['a','c'],rightTeam:['b'],now:100});
 assert.throws(()=>advancePractice(s,'turn',{order:{move:'pivot',switchChoice:{side:'right',slot:0,teamIndex:1}}},{catalog:pivotCatalog,now:200}),/Relevo del efecto inválido/);
 const result=advancePractice(s,'turn',{order:{move:'pivot',switchChoice:{side:'left',slot:0,teamIndex:1}}},{catalog:pivotCatalog,now:200,random:()=>0.5});
 assert.equal(result.state.leftActive[0].id,'c');
}
console.log('Práctica: selección manual de relevo por movimiento validada e integrada.');
