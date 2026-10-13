import assert from 'node:assert/strict';
import {completedOutcome} from './worker.js';
const side=hp=>[{hp}];
assert.deepEqual(completedOutcome({leftTeam:side(0),rightTeam:side(0)}),{finished:true,winner:null,reason:'double_ko'});
assert.deepEqual(completedOutcome({leftTeam:side(1),rightTeam:side(0)}),{finished:true,winner:'host',reason:'ko'});
assert.deepEqual(completedOutcome({leftTeam:side(0),rightTeam:side(2)}),{finished:true,winner:'guest',reason:'ko'});
assert.equal(completedOutcome({leftTeam:side(1),rightTeam:side(2)}).finished,false);
console.log('alpha 0.4 outcome: double KO draw and single-side victories OK');
