import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
const rule=(action,target='self',extra={})=>({event:'manual',target,action,chance:100,duration:0,limit:0,conditions:[],condition:{type:'always',value:''},operator:'AND',negate:false,...extra});
const move=(id,type='agua',targeting='single',power=0,category='status',priority=0,rules=[])=>({id,name:id,definition:{kind:'global',type,category,targeting,power,accuracy:0,criticalChance:0,priority,cooldown:0,rules}});
const entity=(id,speed=100)=>({id,name:id,definition:{hp:500,attack:100,defense:100,specialAttack:100,specialDefense:100,speed,types:['agua'],moveIds:['hit','idle','idle'],uniqueMoveId:'idle',globalAbilityId:'ab',uniqueAbilityId:'ab'}});
const items={
 apple:{id:'apple',name:'Manzana',definition:{timing:'start',priority:0,rules:[rule({type:'heal',value:25}),rule({type:'heal_over_time',value:5},'self',{duration:5})]}},
 swap:{id:'swap',name:'Intercambio',definition:{timing:'start',priority:0,rules:[rule({type:'swap_positions'},'enemy_team')]}},
 late:{id:'late',name:'Objeto de cierre',definition:{timing:'end',priority:0,rules:[rule({type:'heal',value:15})]}},
 laser:{id:'laser',name:'Pistola láser',definition:{timing:'start',rules:[rule({type:'attack',attack:{category:'special',type:'neutral',power:10,accuracy:0,criticalChance:0,chance:100,animate:false,target:'enemy_team',hits:10,rules:[]}},'enemy_team')]}},
};
const catalog={entities:{a:entity('a',110),b:entity('b',80),x:entity('x',50),y:entity('y',60)},moves:{hit:move('hit','agua','enemy_direct',90,'special'),idle:move('idle','agua','self',0,'status')},abilities:{ab:{id:'ab',definition:{kind:'global',rules:[]}}},effects:{},statuses:{},items};
const actions=(...list)=>({actions:list.map((a,slot)=>({slot,...a}))});
const sim=(config={})=>simulate({catalog,chart:{},leftTeam:['a','b'],rightTeam:['x','y'],mode:'doubles',turns:1,randomSource:()=>0.45,leftItems:['swap','apple','laser'],rightItems:['late'],leftOrders:[actions({move:'hit',item:'swap'},{move:'idle'})],rightOrders:[actions({move:'idle'},{move:'idle'})],...config});
const moved=sim();
assert.deepEqual(moved.rightActiveIndexes,[1,0], 'intercambio permuta ambos lugares');
assert.ok(moved.rightTeam[1].hp<500,'el ataque dirigido a una posición golpea al nuevo ocupante');
assert.equal(moved.rightTeam[0].hp,500,'el antiguo ocupante de la posición no recibe ese golpe');
assert.ok(moved.usedItems.left.includes('swap'),'el objeto ejecutado se consume');
assert.ok(moved.visualEvents.some(e=>e.type==='item_use'&&e.itemId==='swap'));
assert.ok(moved.visualEvents.some(e=>e.type==='swap_positions'));
const noUse=sim({leftOrders:[actions({move:'hit'},{move:'idle'})]});assert.equal(noUse.usedItems.left.length,0,'un objeto no seleccionado no se consume');
const recovered=sim({leftOrders:[actions({move:'idle',item:'apple'},{move:'idle'})]});
assert.ok(recovered.usedItems.left.includes('apple'),'la recuperación consume el objeto al ejecutarse');
assert.ok(recovered.leftTeam[0].effects.some(e=>e.id==='heal_over_time'),'la manzana aplica recuperación periódica');
const neutral=sim({leftOrders:[actions({move:'idle',item:'laser'},{move:'idle'})]});
assert.equal(neutral.log.filter(x=>x.includes('realiza un ataque adicional')).length,10,'láser reparte diez impactos');
assert.ok(neutral.rightTeam.every(u=>u.hp<500),'láser afecta ambos rivales');
const notConsumed=sim({leftOrders:[actions({move:'idle'},{move:'idle'})],rightOrders:[actions({move:'idle',item:'late'},{move:'idle'})]});
assert.deepEqual(notConsumed.usedItems.right,['late'],'objeto rival se consume normalmente');
console.log('Objetos: selección, ejecución, reserva, neutral, multiimpacto, manzana, intercambio y posiciones: OK');

// Cobertura de fallos de activación, bloqueo, repetición y Singles.
const blockedRule=rule({type:'block_items'},'target',{duration:3});
const lethalRule=rule({type:'damage',value:100},'target');
const alwaysFalse=rule({type:'heal',value:10},'self',{condition:{type:'hp_below',value:1}});
const zeroChance=rule({type:'heal',value:10},'self',{chance:0});
const moreCatalog=structuredClone(catalog);
moreCatalog.moves.ban=move('ban','agua','single',0,'status',5,[blockedRule]);
moreCatalog.moves.kill=move('kill','agua','single',0,'status',5,[lethalRule]);
moreCatalog.entities.x.definition.moveIds=['ban','kill','idle'];
moreCatalog.items.false={id:'false',name:'Sin condición',definition:{timing:'start',rules:[alwaysFalse]}};
moreCatalog.items.zero={id:'zero',name:'Sin probabilidad',definition:{timing:'start',rules:[zeroChance]}};
moreCatalog.items.apple.definition.narratorMessage='[PERSONAJE] comió [OBJETO].';
const noCondition=sim({catalog:moreCatalog,leftItems:['false'],leftOrders:[actions({move:'idle',item:'false'},{move:'idle'})]});
assert.deepEqual(noCondition.usedItems.left,[],'si la condición de un objeto es falsa no se consume');
const noChance=sim({catalog:moreCatalog,leftItems:['zero'],leftOrders:[actions({move:'idle',item:'zero'},{move:'idle'})]});
assert.deepEqual(noChance.usedItems.left,[],'si ninguna regla del objeto se activa por probabilidad no se consume');
const customNarrator=sim({catalog:moreCatalog,leftOrders:[actions({move:'idle',item:'apple'},{move:'idle'})]});
assert.ok(customNarrator.log.some(x=>x.includes('usó Manzana.')),'el narrador impone el texto universal aun si hay un mensaje histórico personalizado');
assert.ok(!customNarrator.log.some(x=>x.includes('comió Manzana.')),'el texto personalizado no se utiliza');
const directBlocked=sim({catalog:moreCatalog,leftItems:['apple'],rightItems:[],leftOrders:[actions({move:'idle',item:'apple'},{move:'idle'})],rightOrders:[actions({move:'ban',target:{side:'left',slot:0}},{move:'idle'})]});
// Objetos al inicio actúan antes de un bloqueo en mitad del turno. Comprobar con objeto tardío.
assert.ok(directBlocked.usedItems.left.includes('apple'),'la activación de inicio precede a bloqueo de prioridad 5');
const delayedBlocked=sim({catalog:moreCatalog,leftItems:['late'],rightItems:[],leftOrders:[actions({move:'idle',item:'late'},{move:'idle'})],rightOrders:[actions({move:'ban',target:{side:'left',slot:0}},{move:'idle'})]});
assert.deepEqual(delayedBlocked.usedItems.left,[],'bloqueo previo impide consumir el objeto tardío');
const knockedOut=sim({catalog:moreCatalog,leftItems:['late'],rightItems:[],leftOrders:[actions({move:'idle',item:'late'},{move:'idle'})],rightOrders:[actions({move:'kill',target:{side:'left',slot:0}},{move:'idle'})]});
assert.deepEqual(knockedOut.usedItems.left,[],'KO previo a ejecución impide consumo');
const reused=sim({catalog:moreCatalog,turns:2,leftItems:['apple'],rightItems:[],leftOrders:[actions({move:'idle',item:'apple'},{move:'idle'}),actions({move:'idle',item:'apple'},{move:'idle'})],rightOrders:[actions({move:'idle'},{move:'idle'}),actions({move:'idle'},{move:'idle'})]});
assert.equal(reused.visualEvents.filter(e=>e.type==='item_use'&&e.itemId==='apple').length,1,'objeto ejecutado solo una vez por batalla');
const singleOnly=simulate({catalog:moreCatalog,chart:{},leftTeam:['a','b'],rightTeam:['x','y'],mode:'singles',turns:1,randomSource:()=>0.5,leftItems:['swap'],rightItems:[],leftOrders:[actions({move:'idle',item:'swap'})],rightOrders:[actions({move:'idle'})]});
assert.deepEqual(singleOnly.usedItems.left,[],'intercambio de posiciones es exclusivo Doubles');
console.log('Casos límite de objetos (condiciones, bloqueo, KO, consumo, narrador, Singles): OK');


// Objeto de cambio final: funciona con una reserva y no se consume si es imposible cambiar.
const ejectItem={id:'eject',name:'Asiento eyector',definition:{timing:'last',priority:-5,rules:[rule({type:'switch_character',switchMode:'random'},'self')]}};
const ejectCatalog=structuredClone(moreCatalog);ejectCatalog.entities.z=entity('z');ejectCatalog.items.eject=ejectItem;
const ejectOrder={catalog:ejectCatalog,leftItems:['eject'],rightItems:[],leftOrders:[actions({move:'hit',item:'eject'},{move:'idle'})],rightOrders:[actions({move:'idle'},{move:'idle'})]};
const ejected=sim({...ejectOrder,leftTeam:['a','b','z']});
assert.deepEqual(ejected.leftActiveIndexes,[2,1],'asiento eyector fuerza relevo de usuario en el último momento');
assert.ok(ejected.usedItems.left.includes('eject'),'asiento eyector ejecutado se consume');
assert.ok(ejected.visualEvents.some(e=>e.type==='item_use'&&e.itemId==='eject'),'asiento eyector emite animación');
const noBench=sim(ejectOrder);
assert.deepEqual(noBench.usedItems.left,[],'sin reserva válida, asiento eyector no se consume');
console.log('Asiento eyector: orden de ejecución y reservas: OK');
